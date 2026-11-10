use curve25519_dalek::edwards::CompressedEdwardsY;
use curve25519_dalek::traits::IsIdentity;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_sdk::json_types::U128;
use near_sdk::store::{LookupSet, Vector};
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
    announcements: Vector<Announcement>,
    allowed_tokens: LookupSet<AccountId>,
    owner_id: AccountId,
}

#[near]
impl Router {
    #[init]
    pub fn new() -> Self {
        Self {
            announcements: Vector::new(b'a'),
            allowed_tokens: LookupSet::new(b't'),
            owner_id: env::predecessor_account_id(),
        }
    }

    pub fn set_ft_allowed(&mut self, token: AccountId, allowed: bool) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "only owner");
        if allowed {
            self.allowed_tokens.insert(token);
        } else {
            self.allowed_tokens.remove(&token);
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
        assert_valid_point(&ephemeral_pub_hex, "ephemeral key");
        assert_valid_account_point(&stealth_account, "derived key");
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
        assert_valid_point(&ephemeral_pub_hex, "ephemeral key");
        assert_valid_account_point(&stealth_account, "derived key");
        let before = env::storage_usage();
        self.append_announcement(token, stealth_account, ephemeral_pub_hex, view_tag, amount);
        let used = env::storage_usage().saturating_sub(before);
        let required =
            NearToken::from_yoctonear(u128::from(used) * env::storage_byte_cost().as_yoctonear());
        assert!(
            env::attached_deposit() >= required,
            "insufficient storage deposit"
        );
        let refund = env::attached_deposit().saturating_sub(required);
        if refund > NearToken::from_yoctonear(0) {
            let _ = Promise::new(env::predecessor_account_id()).transfer(refund);
        }
    }

    pub fn get_announcements(&self, from_index: u64, limit: u64) -> Vec<Announcement> {
        let length = u64::from(self.announcements.len());
        let start = from_index.min(length) as u32;
        let end = (u64::from(start) + limit.min(100)).min(length) as u32;
        (start..end)
            .filter_map(|index| self.announcements.get(index).cloned())
            .collect()
    }

    pub fn total_announcements(&self) -> u64 {
        u64::from(self.announcements.len())
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
            index: u64::from(self.announcements.len()),
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
        let token_id = env::predecessor_account_id();
        if !self.allowed_tokens.contains(&token_id) {
            return PromiseOrValue::Value(amount);
        }
        let Ok(message) = near_sdk::serde_json::from_str::<FtMessage>(&msg) else {
            return PromiseOrValue::Value(amount);
        };
        if message.ephemeral_pub_hex.len() != 64 {
            return PromiseOrValue::Value(amount);
        }
        assert_valid_point(&message.ephemeral_pub_hex, "ephemeral key");
        assert_valid_account_point(&message.stealth_account, "derived key");
        let callback_args = near_sdk::serde_json::json!({
            "sender_id": sender_id,
            "token_id": token_id,
            "amount": amount.0.to_string(),
            "stealth_account": message.stealth_account,
            "ephemeral_pub_hex": message.ephemeral_pub_hex,
            "view_tag": message.view_tag,
        })
        .to_string()
        .into_bytes();
        let transfer_args = near_sdk::serde_json::json!({
            "receiver_id": message.stealth_account,
            "amount": amount.0.to_string(),
            "memo": "veil-private-send",
        })
        .to_string()
        .into_bytes();
        PromiseOrValue::Promise(
            Promise::new(token_id.clone())
                .function_call(
                    "ft_transfer".to_string(),
                    transfer_args,
                    NearToken::from_yoctonear(1),
                    Gas::from_tgas(30),
                )
                .then(Promise::new(env::current_account_id()).function_call(
                    "on_ft_forward_complete".to_string(),
                    callback_args,
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(5),
                )),
        )
    }
}

#[near]
impl Router {
    #[private]
    pub fn on_ft_forward_complete(
        &mut self,
        sender_id: AccountId,
        token_id: AccountId,
        amount: String,
        stealth_account: AccountId,
        ephemeral_pub_hex: String,
        view_tag: u8,
    ) {
        if env::promise_result_checked(0, 0).is_ok() {
            let before = env::storage_usage();
            self.append_announcement(
                token_id,
                stealth_account,
                ephemeral_pub_hex,
                view_tag,
                Some(amount),
            );
            let used = env::storage_usage().saturating_sub(before);
            let required = NearToken::from_yoctonear(
                u128::from(used) * env::storage_byte_cost().as_yoctonear(),
            );
            assert!(
                env::account_balance() >= required,
                "router storage reserve exhausted"
            );
        } else {
            let refund_args = near_sdk::serde_json::json!({
                "receiver_id": sender_id,
                "amount": amount,
            })
            .to_string()
            .into_bytes();
            let _ = Promise::new(token_id).function_call(
                "ft_transfer".to_string(),
                refund_args,
                NearToken::from_yoctonear(1),
                Gas::from_tgas(30),
            );
        }
    }
}

fn assert_valid_account_point(account_id: &AccountId, label: &str) {
    let value = account_id.as_str();
    assert!(
        value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit()),
        "{label} must be a 32-byte implicit account"
    );
    let mut bytes = [0u8; 32];
    for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        bytes[index] = (hex_digit(pair[0]).expect("hex") << 4) | hex_digit(pair[1]).expect("hex");
    }
    let point = CompressedEdwardsY(bytes)
        .decompress()
        .expect("derived key must be a valid Edwards point");
    assert!(
        !point.is_identity(),
        "{label} must not be the identity point"
    );
    assert!(
        bool::from(point.is_torsion_free()),
        "{label} must be torsion-free"
    );
}

fn assert_valid_point(hex: &str, label: &str) {
    assert!(hex.len() == 64, "{label} must be 32-byte hex");
    let mut bytes = [0u8; 32];
    for (index, pair) in hex.as_bytes().chunks_exact(2).enumerate() {
        bytes[index] = (hex_digit(pair[0]).expect("hex") << 4) | hex_digit(pair[1]).expect("hex");
    }
    let point = CompressedEdwardsY(bytes)
        .decompress()
        .expect("point must be valid");
    assert!(
        !point.is_identity(),
        "{label} must not be the identity point"
    );
    assert!(
        bool::from(point.is_torsion_free()),
        "{label} must be torsion-free"
    );
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
    use near_sdk::{testing_env, PromiseOrValue, PromiseResult, RuntimeFeesConfig};

    fn context(deposit: NearToken) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(accounts(0))
            .current_account_id(accounts(0))
            .attached_deposit(deposit);
        builder
    }

    fn point_hex(_seed: char) -> String {
        format!("58{}", "66".repeat(31))
    }
    fn implicit(seed: char) -> AccountId {
        point_hex(seed).parse().expect("implicit account")
    }

    #[test]
    fn appends_and_paginates_announcements() {
        testing_env!(context(NearToken::from_near(1)).build());
        let mut router = Router::new();
        router.announce(
            accounts(1),
            implicit('6'),
            point_hex('6'),
            7,
            Some("10".into()),
        );
        router.announce(accounts(1), implicit('7'), point_hex('7'), 8, None);
        assert_eq!(router.total_announcements(), 2);
        assert_eq!(
            router.get_announcements(1, 10)[0].stealth_account,
            implicit('7')
        );
    }

    #[test]
    #[should_panic(expected = "ephemeral key must be 32-byte hex")]
    fn rejects_malformed_ephemeral_key() {
        testing_env!(context(NearToken::from_near(1)).build());
        let mut router = Router::new();
        router.announce(accounts(1), accounts(2), "bad".into(), 7, None);
    }

    #[test]
    fn accepts_ft_transfer_call_and_records_token_and_amount() {
        let mut builder = context(NearToken::from_yoctonear(0));
        builder.predecessor_account_id(accounts(1));
        testing_env!(builder.build());
        let mut router = Router::new();
        router.set_ft_allowed(accounts(1), true);
        let msg = near_sdk::serde_json::json!({
            "stealth_account": implicit('8'),
            "ephemeral_pub_hex": point_hex('8'),
            "view_tag": 9
        })
        .to_string();
        match router.ft_on_transfer(accounts(3), U128(42), msg) {
            PromiseOrValue::Value(value) => panic!("forwarding FT receiver returned {value:?}"),
            PromiseOrValue::Promise(_) => {}
        }
        testing_env!(
            context(NearToken::from_yoctonear(0)).build(),
            near_sdk::test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );
        router.on_ft_forward_complete(
            accounts(3),
            accounts(1),
            "42".into(),
            implicit('8'),
            point_hex('8'),
            9,
        );
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
    fn failed_ft_forward_refunds_and_does_not_announce() {
        testing_env!(
            context(NearToken::from_yoctonear(0)).build(),
            near_sdk::test_vm_config(),
            RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        let mut router = Router::new();
        router.on_ft_forward_complete(
            accounts(3),
            accounts(1),
            "42".into(),
            implicit('9'),
            point_hex('9'),
            9,
        );
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
            implicit('a'),
            point_hex('a'),
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
            implicit('b'),
            point_hex('b'),
            5,
            NearToken::from_near(1).as_yoctonear().to_string(),
        );
        assert_eq!(router.total_announcements(), 1);
    }
}
