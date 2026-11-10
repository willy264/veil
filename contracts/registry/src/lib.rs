use curve25519_dalek::edwards::CompressedEdwardsY;
use curve25519_dalek::traits::IsIdentity;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};

const MIN_STORAGE_DEPOSIT: NearToken = NearToken::from_yoctonear(1_000_000_000_000_000_000_000);

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Eq)]
pub struct Meta {
    pub spend_pub_hex: String,
    pub view_pub_hex: String,
    pub scheme_id: u8,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    metas: LookupMap<AccountId, Meta>,
    storage_deposits: LookupMap<AccountId, NearToken>,
}

#[near]
impl Registry {
    #[init]
    pub fn new() -> Self {
        Self {
            metas: LookupMap::new(b'm'),
            storage_deposits: LookupMap::new(b'd'),
        }
    }

    #[payable]
    pub fn register(&mut self, spend_pub_hex: String, view_pub_hex: String, scheme_id: u8) {
        let account_id = env::predecessor_account_id();
        let attached = env::attached_deposit();
        assert!(
            attached >= MIN_STORAGE_DEPOSIT,
            "attach at least {} yoctoNEAR",
            MIN_STORAGE_DEPOSIT.as_yoctonear()
        );
        assert_eq!(spend_pub_hex.len(), 64, "spend key must be 32-byte hex");
        assert_eq!(view_pub_hex.len(), 64, "view key must be 32-byte hex");
        assert_eq!(scheme_id, 1, "unsupported scheme");
        assert_valid_point(&spend_pub_hex, "spend key");
        assert_valid_point(&view_pub_hex, "view key");
        let before = env::storage_usage();
        self.metas.insert(
            account_id.clone(),
            Meta {
                spend_pub_hex,
                view_pub_hex,
                scheme_id,
            },
        );
        let required = NearToken::from_yoctonear(
            u128::from(env::storage_usage().saturating_sub(before))
                * env::storage_byte_cost().as_yoctonear(),
        );
        assert!(attached >= required, "insufficient storage deposit");
        let previous = self.storage_deposits.insert(account_id.clone(), required);
        let refund = attached.saturating_sub(required);
        if let Some(previous) = previous {
            let _ = Promise::new(account_id.clone()).transfer(previous);
        }
        if refund > NearToken::from_yoctonear(0) {
            let _ = Promise::new(account_id.clone()).transfer(refund);
        }
        env::log_str(&format!(
            r#"{{"standard":"veil","event":"meta_registered","account_id":"{}"}}"#,
            account_id
        ));
    }

    pub fn unregister(&mut self) {
        let account_id = env::predecessor_account_id();
        self.metas.remove(&account_id);
        if let Some(deposit) = self.storage_deposits.remove(&account_id) {
            let _ = Promise::new(account_id).transfer(deposit);
        }
    }

    pub fn get_meta(&self, account_id: AccountId) -> Option<Meta> {
        self.metas.get(&account_id).cloned()
    }

    pub fn storage_deposit(&mut self) {
        let account_id = env::predecessor_account_id();
        let attached = env::attached_deposit();
        assert!(attached > NearToken::from_yoctonear(0), "attach a deposit");
        let current = self
            .storage_deposits
            .entry(account_id)
            .or_insert(NearToken::from_yoctonear(0));
        *current = current.saturating_add(attached);
    }
}

fn assert_valid_point(hex: &str, label: &str) {
    let bytes =
        decode_hex(hex).unwrap_or_else(|| env::panic_str(&format!("{label} must be valid hex")));
    let point = CompressedEdwardsY(bytes)
        .decompress()
        .unwrap_or_else(|| env::panic_str(&format!("{label} must be a valid Edwards point")));
    assert!(
        !point.is_identity(),
        "{label} must not be the identity point"
    );
    assert!(
        bool::from(point.is_torsion_free()),
        "{label} must be torsion-free"
    );
}

fn decode_hex(value: &str) -> Option<[u8; 32]> {
    if value.len() != 64 {
        return None;
    }
    let mut output = [0u8; 32];
    for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        output[index] = (hex_digit(pair[0])? << 4) | hex_digit(pair[1])?;
    }
    Some(output)
}

fn hex_digit(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn context(account: AccountId, deposit: NearToken) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(account)
            .attached_deposit(deposit);
        builder
    }

    fn point_hex() -> String {
        format!("58{}", "66".repeat(31))
    }

    #[test]
    fn register_and_resolve_meta() {
        testing_env!(context(accounts(0), MIN_STORAGE_DEPOSIT).build());
        let mut registry = Registry::new();
        registry.register(point_hex(), point_hex(), 1);
        let meta = registry.get_meta(accounts(0)).expect("registered meta");
        assert_eq!(meta.scheme_id, 1);
        assert_eq!(meta.spend_pub_hex, point_hex());
    }

    #[test]
    #[should_panic(expected = "unsupported scheme")]
    fn rejects_unknown_scheme() {
        testing_env!(context(accounts(0), MIN_STORAGE_DEPOSIT).build());
        let mut registry = Registry::new();
        registry.register(point_hex(), point_hex(), 2);
    }
}
