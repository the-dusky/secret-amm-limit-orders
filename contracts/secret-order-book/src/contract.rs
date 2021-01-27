use cosmwasm_std::{Api, Binary, CosmosMsg, Env, Extern, HandleResponse, HumanAddr, InitResponse, Querier, StdError, StdResult, Storage, Uint128, WasmMsg, from_binary, to_binary};
use cosmwasm_storage::{PrefixedStorage, ReadonlyPrefixedStorage};
use secret_toolkit::{utils::HandleCallback};

use crate::{msg::{FactoryHandleMsg, HandleMsg, InitMsg, QueryAnswer, Snip20Msg, QueryMsg}, state::{load, may_load, save}};

/// storage key for the factory
pub const FACTORY_DATA: &[u8] = b"factory"; // address, hash, key
/// response size
pub const TOKEN1_DATA: &[u8] = b"token1"; // address, hash
/// response size
pub const TOKEN2_DATA: &[u8] = b"token2"; // address, hash
/// response size
pub const BLOCK_SIZE: usize = 256;

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
) -> StdResult<InitResponse> {
    let mut factory_data = PrefixedStorage::new(FACTORY_DATA, &mut deps.storage);
    save(&mut factory_data, b"address", &msg.factory_address)?;
    save(&mut factory_data, b"hash", &msg.factory_hash)?;
    save(&mut factory_data, b"key", &msg.factory_key)?;

    let mut token1_data = PrefixedStorage::new(TOKEN1_DATA, &mut deps.storage);
    save(&mut token1_data, b"address", &msg.token1_code_address)?;
    save(&mut token1_data, b"hash", &msg.token1_code_hash)?;

    let mut token2_data = PrefixedStorage::new(TOKEN2_DATA, &mut deps.storage);
    save(&mut token2_data, b"address", &msg.token2_code_address)?;
    save(&mut token2_data, b"hash", &msg.token2_code_hash)?;

    // send register to snip20
    let snip20_register_msg = to_binary(&Snip20Msg::register_receive(env.contract_code_hash))?;
    let token1_msg = CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: msg.token1_code_address.clone(),
        callback_code_hash: msg.token1_code_hash,
        msg: snip20_register_msg.clone(),
        send: vec![],
    });
    let token2_msg = CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: msg.token2_code_address.clone(),
        callback_code_hash: msg.token2_code_hash,
        msg: snip20_register_msg.clone(),
        send: vec![],
    });
    
    // send callback to factory
    let callback_msg = FactoryHandleMsg::InitCallBackFromSecretOrderBookToFactory {
        auth_key: msg.factory_key.clone(),
        contract_address: env.contract.address,
        token1_address: msg.token1_code_address.clone(),
        token2_address: msg.token2_code_address.clone(),
    };

    let cosmos_msg = callback_msg.to_cosmos_msg(msg.factory_hash.clone(), msg.factory_address.clone(), None)?;

    Ok(InitResponse {
        messages: vec![
            token1_msg,
            token2_msg,
            cosmos_msg,
        ],
        log: vec![],
    })
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
) -> StdResult<HandleResponse> {
    match msg {
        // Receiver to CreateLimitOrder
        HandleMsg::Receive { sender, from, amount, msg } => try_receive(deps, env, sender, from, amount, msg),
        _ => Err(StdError::generic_err("Handler not found!"))
    } 
}

pub fn try_receive<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    _sender: HumanAddr,
    from: HumanAddr,
    amount: Uint128,
    msg: Binary,
) -> StdResult<HandleResponse> {
    let msg: HandleMsg = from_binary(&msg)?;

    if matches!(msg, HandleMsg::Receive { .. }) {
        return Err(StdError::generic_err(
            "Recursive call to receive() is not allowed",
        ));
    }

    let token1_data = ReadonlyPrefixedStorage::new(TOKEN1_DATA, &deps.storage);
    let token2_data = ReadonlyPrefixedStorage::new(TOKEN2_DATA, &deps.storage);
    let load_token1_address: HumanAddr = load(&token1_data, b"address")?;
    let load_token2_address: HumanAddr = load(&token2_data, b"address")?;

    if load_token1_address != env.message.sender && load_token2_address != env.message.sender { 
        return Err(StdError::generic_err(format!(
            "{} is not a known SNIP-20 coin that this contract registered to",
            env.message.sender
        )));
    }
    
    if let HandleMsg::CreateLimitOrder { } = msg.clone() {
        return create_limit_order(deps, env, from, amount)
    } else {
        return Err(StdError::generic_err(format!(
            "Receive handler not found!"
        )));
    }
}

pub fn create_limit_order<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    _env: Env,
    from: HumanAddr,
    amount: Uint128
) -> StdResult<HandleResponse> {
    Ok(HandleResponse::default())
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetLimitOrders {} => to_binary(&QueryAnswer::LimitOrders {
        }),
    }
}