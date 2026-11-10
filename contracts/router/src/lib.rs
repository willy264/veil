use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};

#[near(serializers = [json])]
struct FtMessage {
    stealth_account: AccountId,
    ephemeral_pub_hex: String,
    view_tag: u8,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Announcement {
    pub index: u64,
    pub block_height: u64,
    pub token: AccountId,
    pub stealth_account: AccountId,
    pub ephemeral_pub_hex: String,
    pub view_tag: u8,
    pub amount: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Router {
    announcements: Vec<Announcement>,
}

#[near]
impl Router {
    #[init]
    pub fn new() -> Self {
        Self {
            announcements: Vec::new(),
        }
    }

    #[payable]
    pub fn send_near(
        &mut self,
        stealth_account: AccountId,
        ephemeral_pub_hex: String,
        view_tag: u8,
    ) -> Promise {
        let amount = env::attached_deposit();
        assert!(amount > NearToken::from_yoctonear(0), "attach NEAR to send");
        assert_eq!(
            ephemeral_pub_hex.len(),
            64,
            "ephemeral key must be 32-byte hex"
        );
        let sender = env::predecessor_account_id();
        let callback_args = near_sdk::serde_json::json!({
            "sender": sender,
            "stealth_account": stealth_account,
            "ephemeral_pub_hex": ephemeral_pub_hex,
            "view_tag": view_tag,
            "amount": amount.as_yoctonear().to_string(),
        })
        .to_string()
        .into_bytes();
        Promise::new(stealth_account).transfer(amount).then(
            Promise::new(env::current_account_id()).function_call(
                "on_near_transfer_complete".to_string(),
                callback_args,
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            ),
        )
    }

    #[private]
    pub fn on_near_transfer_complete(
        &mut self,
        sender: AccountId,
        stealth_account: AccountId,
        ephemeral_pub_hex: String,
        view_tag: u8,
        amount: String,
    ) {
        if env::promise_result_checked(0, 0).is_ok() {
            self.append_announcement(
                env::current_account_id(),
                stealth_account,
                ephemeral_pub_hex,
                view_tag,
                Some(amount),
            );
        } else {
            let refund = amount.parse::<u128>().expect("amount must be yoctoNEAR");
            let _ = Promise::new(sender).transfer(NearToken::from_yoctonear(refund));
        }
    }

    #[payable]
    pub fn announce(
        &mut self,
        token: AccountId,
        stealth_account: AccountId,
        ephemeral_pub_hex: String,
        view_tag: u8,
        amount: Option<String>,
    ) {
        assert!(
            env::attached_deposit() > NearToken::from_yoctonear(0),
            "attach announcement storage deposit"
        );
        self.append_announcement(token, stealth_account, ephemeral_pub_hex, view_tag, amount);
    }

    pub fn get_announcements(&self, from_index: u64, limit: u64) -> Vec<Announcement> {
        let start = from_index.min(self.announcements.len() as u64) as usize;
        let end = (start as u64 + limit.min(100)).min(self.announcements.len() as u64) as usize;
        self.announcements[start..end].to_vec()
    }

    pub fn total_announcements(&self) -> u64 {
        self.announcements.len() as u64
    }

    fn append_announcement(
        &mut self,
        token: AccountId,
        stealth_account: AccountId,
        ephemeral_pub_hex: String,
        view_tag: u8,
        amount: Option<String>,
    ) {
        assert_eq!(
            ephemeral_pub_hex.len(),
            64,
            "ephemeral key must be 32-byte hex"
        );
        let announcement = Announcement {
            index: self.announcements.len() as u64,
            block_height: env::block_height(),
            token,
            stealth_account,
            ephemeral_pub_hex,
            view_tag,
            amount,
        };
        env::log_str(&format!(
            r#"{{"standard":"veil","event":"stealth_sent","index":{}}}"#,
            announcement.index
        ));
        self.announcements.push(announcement);
    }
}

#[near]
impl FungibleTokenReceiver for Router {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let _ = sender_id;
        let Ok(message) = near_sdk::serde_json::from_str::<FtMessage>(&msg) else {
            return PromiseOrValue::Value(amount);
        };
        if message.ephemeral_pub_hex.len() != 64 {
            return PromiseOrValue::Value(amount);
        }
        self.append_announcement(
            env::predecessor_account_id(),
            message.stealth_account,
            message.ephemeral_pub_hex,
            message.view_tag,
            Some(amount.0.to_string()),
        );
        PromiseOrValue::Value(U128(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, PromiseOrValue, PromiseResult, RuntimeFeesConfig};

    fn context(deposit: NearToken) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(accounts(0))
            .current_account_id(accounts(0))
            .attached_deposit(deposit);
        builder
    }

    #[test]
    fn appends_and_paginates_announcements() {
        testing_env!(context(NearToken::from_yoctonear(1)).build());
        let mut router = Router::new();
        router.announce(
            accounts(1),
            accounts(2),
            "11".repeat(32),
            7,
            Some("10".into()),
        );
        router.announce(accounts(1), accounts(3), "22".repeat(32), 8, None);
        assert_eq!(router.total_announcements(), 2);
        assert_eq!(
            router.get_announcements(1, 10)[0].stealth_account,
            accounts(3)
        );
    }

    #[test]
    #[should_panic(expected = "ephemeral key must be 32-byte hex")]
    fn rejects_malformed_ephemeral_key() {
        testing_env!(context(NearToken::from_yoctonear(1)).build());
        let mut router = Router::new();
        router.announce(accounts(1), accounts(2), "bad".into(), 7, None);
    }

    #[test]
    fn accepts_ft_transfer_call_and_records_token_and_amount() {
        let mut builder = context(NearToken::from_yoctonear(0));
        builder.predecessor_account_id(accounts(1));
        testing_env!(builder.build());
        let mut router = Router::new();
        let msg = near_sdk::serde_json::json!({
            "stealth_account": accounts(2),
            "ephemeral_pub_hex": "33".repeat(32),
            "view_tag": 9
        })
        .to_string();
        match router.ft_on_transfer(accounts(3), U128(42), msg) {
            PromiseOrValue::Value(value) => assert_eq!(value, U128(0)),
            PromiseOrValue::Promise(_) => panic!("FT receiver must return a value"),
        }
        let announcement = &router.get_announcements(0, 1)[0];
        assert_eq!(announcement.token, accounts(1));
        assert_eq!(announcement.amount.as_deref(), Some("42"));
    }

    #[test]
    fn malformed_ft_message_returns_the_full_amount() {
        let mut builder = context(NearToken::from_yoctonear(0));
        builder.predecessor_account_id(accounts(1));
        testing_env!(builder.build());
        let mut router = Router::new();
        match router.ft_on_transfer(accounts(3), U128(42), "not-json".into()) {
            PromiseOrValue::Value(value) => assert_eq!(value, U128(42)),
            PromiseOrValue::Promise(_) => panic!("malformed FT message must be refunded"),
        }
        assert_eq!(router.total_announcements(), 0);
    }

    #[test]
    fn failed_near_forward_does_not_record_announcement() {
        let builder = context(NearToken::from_near(1));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        let mut router = Router::new();
        router.on_near_transfer_complete(
            accounts(1),
            accounts(2),
            "44".repeat(32),
            4,
            NearToken::from_near(1).as_yoctonear().to_string(),
        );
        assert_eq!(router.total_announcements(), 0);
    }

    #[test]
    fn successful_near_forward_records_announcement() {
        let builder = context(NearToken::from_near(1));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );
        let mut router = Router::new();
        router.on_near_transfer_complete(
            accounts(1),
            accounts(2),
            "55".repeat(32),
            5,
            NearToken::from_near(1).as_yoctonear().to_string(),
        );
        assert_eq!(router.total_announcements(), 1);
    }
}
