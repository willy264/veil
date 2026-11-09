use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise};

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

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

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
        testing_env!(context(NearToken::from_yoctonear(1)));
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
        testing_env!(context(NearToken::from_yoctonear(1)));
        let mut router = Router::new();
        router.announce(accounts(1), accounts(2), "bad".into(), 7, None);
    }
}
