use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};
use std::collections::HashMap;

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
    metas: HashMap<AccountId, Meta>,
    storage_deposits: HashMap<AccountId, NearToken>,
}

#[near]
impl Registry {
    #[init]
    pub fn new() -> Self {
        Self {
            metas: HashMap::new(),
            storage_deposits: HashMap::new(),
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
        self.metas.insert(
            account_id.clone(),
            Meta {
                spend_pub_hex,
                view_pub_hex,
                scheme_id,
            },
        );
        let previous = self.storage_deposits.insert(account_id.clone(), attached);
        if let Some(previous) = previous {
            let _ = Promise::new(account_id.clone()).transfer(previous);
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

    #[test]
    fn register_and_resolve_meta() {
        testing_env!(context(accounts(0), MIN_STORAGE_DEPOSIT).build());
        let mut registry = Registry::new();
        registry.register("11".repeat(32), "22".repeat(32), 1);
        let meta = registry.get_meta(accounts(0)).expect("registered meta");
        assert_eq!(meta.scheme_id, 1);
        assert_eq!(meta.spend_pub_hex, "11".repeat(32));
    }

    #[test]
    #[should_panic(expected = "unsupported scheme")]
    fn rejects_unknown_scheme() {
        testing_env!(context(accounts(0), MIN_STORAGE_DEPOSIT).build());
        let mut registry = Registry::new();
        registry.register("11".repeat(32), "22".repeat(32), 2);
    }
}
