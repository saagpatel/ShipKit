//! Proc macros for shipkit-core.

use darling::{FromDeriveInput, FromField};
use proc_macro::TokenStream;
use quote::quote;
use syn::{DeriveInput, parse_macro_input};

#[derive(FromField)]
#[darling(attributes(settings))]
struct SettingsFieldReceiver {
    ident: Option<syn::Ident>,
    ty: syn::Type,
    #[darling(default)]
    default: Option<syn::Lit>,
}

#[derive(FromDeriveInput)]
#[darling(attributes(settings), supports(struct_named))]
struct SettingsReceiver {
    ident: syn::Ident,
    generics: syn::Generics,
    data: darling::ast::Data<(), SettingsFieldReceiver>,
    namespace: String,
}

/// Derive the `Settings` trait for a struct.
///
/// Requires `#[settings(namespace = "...")]` on the struct.
/// Fields can use `#[settings(default = ...)]` to specify defaults.
///
/// # Example
/// ```ignore
/// #[derive(Debug, Clone, Serialize, Deserialize, Settings)]
/// #[settings(namespace = "appearance")]
/// pub struct AppearanceSettings {
///     #[settings(default = "system")]
///     pub theme: String,
///     #[settings(default = 1.0)]
///     pub font_scale: f64,
///     #[settings(default = true)]
///     pub animations_enabled: bool,
///     pub custom_css: Option<String>,
/// }
/// ```
#[proc_macro_derive(Settings, attributes(settings))]
pub fn derive_settings(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let receiver = match SettingsReceiver::from_derive_input(&input) {
        Ok(r) => r,
        Err(e) => return e.write_errors().into(),
    };

    let struct_name = &receiver.ident;
    let (impl_generics, ty_generics, where_clause) = receiver.generics.split_for_impl();
    let namespace = &receiver.namespace;

    let fields = match &receiver.data {
        darling::ast::Data::Struct(fields) => fields,
        _ => {
            return syn::Error::new_spanned(
                &receiver.ident,
                "Settings can only be derived for structs with named fields",
            )
            .to_compile_error()
            .into();
        }
    };

    let mut errors = Vec::new();
    let mut valid_defaults = Vec::new();
    for field in &fields.fields {
        // darling's `supports(struct_named)` guarantees named fields
        let Some(ident) = &field.ident else { continue };
        let name = ident.to_string();
        let default_json = match &field.default {
            Some(syn::Lit::Str(s)) => {
                let val = s.value();
                Ok(format!(
                    "\"{}\"",
                    val.replace('\\', "\\\\").replace('"', "\\\"")
                ))
            }
            Some(syn::Lit::Bool(b)) => Ok(b.value.to_string()),
            Some(syn::Lit::Int(i)) => Ok(i.base10_digits().to_string()),
            Some(syn::Lit::Float(fl)) => Ok(fl.base10_digits().to_string()),
            Some(other) => Err(syn::Error::new_spanned(
                other,
                "unsupported default value type; use string, bool, int, or float",
            )),
            None => {
                if is_option_type(&field.ty) {
                    Ok("null".to_string())
                } else {
                    Ok(default_for_type(&field.ty))
                }
            }
        };
        match default_json {
            Ok(json) => valid_defaults.push((name, json)),
            Err(e) => errors.push(e),
        }
    }

    if !errors.is_empty() {
        let mut combined = errors.remove(0);
        for e in errors {
            combined.combine(e);
        }
        return combined.to_compile_error().into();
    }

    let default_entries: Vec<_> = valid_defaults
        .iter()
        .map(|(name, json)| {
            quote! { (#name, #json) }
        })
        .collect();

    let expanded = quote! {
        impl #impl_generics shipkit_core::settings::Settings for #struct_name #ty_generics #where_clause {
            fn namespace() -> &'static str {
                #namespace
            }

            fn field_defaults() -> &'static [(&'static str, &'static str)] {
                &[#(#default_entries),*]
            }

            fn load(store: &dyn shipkit_core::settings::SettingsBackend) -> shipkit_core::error::Result<Self> {
                let mut map = serde_json::Map::new();
                for (field, default_json) in Self::field_defaults() {
                    let value = match store.get(Self::namespace(), field)? {
                        Some(v) => v,
                        None => serde_json::from_str(default_json)
                            .map_err(|e| shipkit_core::error::ShipKitError::InvalidSetting {
                                key: field.to_string(),
                                reason: e.to_string(),
                            })?,
                    };
                    map.insert(field.to_string(), value);
                }
                serde_json::from_value(serde_json::Value::Object(map))
                    .map_err(|e| shipkit_core::error::ShipKitError::Serialization(e))
            }

            fn save(&self, store: &dyn shipkit_core::settings::SettingsBackend) -> shipkit_core::error::Result<()> {
                let value = serde_json::to_value(self)?;
                if let serde_json::Value::Object(map) = value {
                    for (key, val) in map {
                        store.set(Self::namespace(), &key, val)?;
                    }
                }
                Ok(())
            }

            fn get_field(
                store: &dyn shipkit_core::settings::SettingsBackend,
                field: &str,
            ) -> shipkit_core::error::Result<serde_json::Value> {
                match store.get(Self::namespace(), field)? {
                    Some(v) => Ok(v),
                    None => {
                        Self::field_defaults()
                            .iter()
                            .find(|(name, _)| *name == field)
                            .map(|(_, default_json)| serde_json::from_str(default_json))
                            .transpose()
                            .map_err(|e| shipkit_core::error::ShipKitError::Serialization(e))?
                            .ok_or_else(|| shipkit_core::error::ShipKitError::SettingNotFound {
                                namespace: Self::namespace().to_string(),
                                key: field.to_string(),
                            })
                    }
                }
            }

            fn set_field(
                store: &dyn shipkit_core::settings::SettingsBackend,
                field: &str,
                value: serde_json::Value,
            ) -> shipkit_core::error::Result<()> {
                if !Self::field_defaults().iter().any(|(name, _)| *name == field) {
                    return Err(shipkit_core::error::ShipKitError::SettingNotFound {
                        namespace: Self::namespace().to_string(),
                        key: field.to_string(),
                    });
                }
                store.set(Self::namespace(), field, value)
            }
        }
    };

    expanded.into()
}

fn is_option_type(ty: &syn::Type) -> bool {
    if let syn::Type::Path(type_path) = ty
        && let Some(segment) = type_path.path.segments.last()
    {
        return segment.ident == "Option";
    }
    false
}

fn default_for_type(ty: &syn::Type) -> String {
    if let syn::Type::Path(type_path) = ty
        && let Some(segment) = type_path.path.segments.last()
    {
        let ident = segment.ident.to_string();
        return match ident.as_str() {
            "String" => "\"\"".to_string(),
            "bool" => "false".to_string(),
            "f32" | "f64" => "0.0".to_string(),
            "i8" | "i16" | "i32" | "i64" | "i128" | "isize" | "u8" | "u16" | "u32" | "u64"
            | "u128" | "usize" => "0".to_string(),
            _ => "null".to_string(),
        };
    }
    "null".to_string()
}
