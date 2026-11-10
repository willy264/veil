use anyhow::Result;
use near_workspaces::types::NearToken;

#[tokio::test]
async fn router_sandbox_round_initializes_and_paginates() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm = near_workspaces::compile_project(".").await?;
    let contract = worker.dev_deploy(&wasm).await?;

    contract.call("new").transact().await?.into_result()?;

    let initial = contract.view("total_announcements").await?.json::<u64>()?;
    assert_eq!(initial, 0);

    let sender = worker.dev_create_account().await?;
    let receiver = worker.dev_create_account().await?;
    sender
        .call(contract.id(), "send_near")
        .args_json(serde_json::json!({
            "stealth_account": receiver.id(),
            "ephemeral_pub_hex": "aa".repeat(32),
            "view_tag": 1
        }))
        .deposit(NearToken::from_near(1))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(
        contract.view("total_announcements").await?.json::<u64>()?,
        1
    );

    let token = worker.dev_create_account().await?;
    token
        .call(contract.id(), "ft_on_transfer")
        .args_json(serde_json::json!({
            "sender_id": sender.id(),
            "amount": "42",
            "msg": serde_json::json!({
                "stealth_account": receiver.id(),
                "ephemeral_pub_hex": "bb".repeat(32),
                "view_tag": 2
            }).to_string()
        }))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(
        contract.view("total_announcements").await?.json::<u64>()?,
        2
    );

    contract
        .call("announce")
        .args_json(serde_json::json!({
            "token": sender.id(),
            "stealth_account": receiver.id(),
            "ephemeral_pub_hex": "11".repeat(32),
            "view_tag": 7,
            "amount": "10"
        }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    let page = contract
        .view("get_announcements")
        .args_json(serde_json::json!({ "from_index": 0, "limit": 1 }))
        .await?
        .json::<Vec<serde_json::Value>>()?;
    assert_eq!(page.len(), 1);
    assert_eq!(page[0]["view_tag"], 1);
    let second_page = contract
        .view("get_announcements")
        .args_json(serde_json::json!({ "from_index": 1, "limit": 10 }))
        .await?
        .json::<Vec<serde_json::Value>>()?;
    assert_eq!(second_page.len(), 2);
    assert_eq!(second_page[0]["view_tag"], 2);
    assert_eq!(second_page[1]["view_tag"], 7);
    Ok(())
}
