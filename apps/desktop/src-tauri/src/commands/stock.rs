//! Tushare Pro 股票数据 API 模块
//! 提供 30+ 股票数据查询工具，供 AI Function Calling 使用

use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::time::Duration;

const TUSHARE_API_URL: &str = "http://api.tushare.pro";
const TUSHARE_KEYRING_SERVICE: &str = "com.aidocplus.tushare";

/// Tushare HTTP 调用封装
async fn tushare_http_call(
    client: &Client,
    token: &str,
    api_name: &str,
    params: Value,
    fields: &str,
) -> Result<Value, String> {
    let body = json!({
        "api_name": api_name,
        "token": token,
        "params": params,
        "fields": fields
    });

    let resp = client
        .post(TUSHARE_API_URL)
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    let result: Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON 解析失败: {}", e))?;

    let code = result.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
    if code != 0 {
        let msg = result
            .get("msg")
            .and_then(|m| m.as_str())
            .unwrap_or("未知错误");
        return Err(format!("Tushare API 错误 ({}): {}", code, msg));
    }

    Ok(result.get("data").cloned().unwrap_or(json!({ "fields": [], "items": [] })))
}

/// 从 keyring 获取 Tushare token
fn get_tushare_token() -> Result<String, String> {
    let entry =
        keyring::Entry::new(TUSHARE_KEYRING_SERVICE, "token").map_err(|e| format!("无法访问密钥链: {}", e))?;
    entry
        .get_password()
        .map_err(|e| format!("未找到 Tushare Token，请先在设置中配置: {}", e))
}

/// 存储 Tushare token 到 keyring
#[tauri::command]
pub fn store_tushare_credential(token: String) -> Result<String, String> {
    if token.is_empty() {
        return Err("Token 不能为空".to_string());
    }
    let entry =
        keyring::Entry::new(TUSHARE_KEYRING_SERVICE, "token").map_err(|e| format!("无法访问密钥链: {}", e))?;
    entry
        .set_password(&token)
        .map_err(|e| format!("存储 Token 失败: {}", e))?;
    Ok("Token 已保存".to_string())
}

/// 删除 Tushare token
#[tauri::command]
pub fn delete_tushare_credential() -> Result<String, String> {
    let entry =
        keyring::Entry::new(TUSHARE_KEYRING_SERVICE, "token").map_err(|e| format!("无法访问密钥链: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok("Token 已删除".to_string()),
        Err(keyring::Error::NoEntry) => Ok("Token 不存在".to_string()),
        Err(e) => Err(format!("删除 Token 失败: {}", e)),
    }
}

/// 验证 Tushare Token 并返回账户信息
#[tauri::command]
pub async fn tushare_token_check() -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    // 使用 trade_cal API 验证 Token（只需 10 积分）
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    let result = tushare_http_call(
        &client,
        &token,
        "trade_cal",
        json!({ "exchange": "SSE", "start_date": &today, "end_date": &today }),
        "exchange,cal_date,is_open"
    ).await;

    match result {
        Ok(_) => Ok(json!({
            "valid": true,
            "token_prefix": &token[..8.min(token.len())]
        })),
        Err(e) => Err(e),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 日期工具函数
// ─────────────────────────────────────────────────────────────────────────────

/// 返回今日日期字符串（YYYYMMDD）
fn today_str() -> String {
    chrono::Local::now().format("%Y%m%d").to_string()
}

/// 返回 N 天前的日期字符串（YYYYMMDD）
fn days_ago_str(n: i64) -> String {
    (chrono::Local::now() - chrono::Duration::days(n)).format("%Y%m%d").to_string()
}

/// 返回 N 年前的日期字符串（YYYYMMDD）
fn years_ago_str(n: i64) -> String {
    days_ago_str(n * 365)
}

// ─────────────────────────────────────────────────────────────────────────────
// 行情数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 股票日线行情
#[tauri::command]
pub async fn stock_daily(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { days_ago_str(60) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "daily",
        params,
        "ts_code,trade_date,open,high,low,close,vol,amount",
    )
    .await?;

    format_daily_result(&result)
}

/// 股票周线行情
#[tauri::command]
pub async fn stock_weekly(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { days_ago_str(180) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "weekly",
        params,
        "ts_code,trade_date,open,high,low,close,vol,amount",
    )
    .await?;

    format_daily_result(&result)
}

/// 股票月线行情
#[tauri::command]
pub async fn stock_monthly(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { years_ago_str(2) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "monthly",
        params,
        "ts_code,trade_date,open,high,low,close,vol,amount",
    )
    .await?;

    format_daily_result(&result)
}

/// 实时行情（当日分时数据）
#[tauri::command]
pub async fn stock_realtime_quote(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "realtime",
        json!({ "ts_code": ts_code }),
        "ts_code,name,open,high,low,close,vol,amount,bid_price,ask_price",
    )
    .await?;

    format_realtime_result(&result)
}

/// 每日涨跌停价格
#[tauri::command]
pub async fn stock_price_limit(ts_code: String, trade_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let params = if !trade_date.is_empty() {
        json!({ "trade_date": trade_date })
    } else {
        json!({ "ts_code": ts_code })
    };

    let result = tushare_http_call(
        &client,
        &token,
        "price_limit",
        params,
        "trade_date,ts_code,name,close,pre_close,pct_change,open,high,low,limit_up,limit_down",
    )
    .await?;

    format_table_result(&result)
}

/// 停复牌数据
#[tauri::command]
pub async fn stock_suspend_d(ts_code: String, suspend_date: String, resume_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !ts_code.is_empty() {
        params["ts_code"] = json!(ts_code);
    }
    if !suspend_date.is_empty() {
        params["suspend_date"] = json!(suspend_date);
    }
    if !resume_date.is_empty() {
        params["resume_date"] = json!(resume_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "suspend_d",
        params,
        "ts_code,suspend_date,resume_date,ann_date,suspend_reason",
    )
    .await?;

    format_table_result(&result)
}

/// 复权因子
#[tauri::command]
pub async fn stock_adj_factor(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { days_ago_str(60) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(&client, &token, "adj_factor", params, "ts_code,trade_date,adj_factor")
        .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 财务数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 利润表
#[tauri::command]
pub async fn stock_income(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { years_ago_str(3) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "income",
        params,
        "ts_code,ann_date,f_ann_date,end_date,report_type,basic_eps,diluted_eps,total_revenue,revenue,total_profit,profit_to_cost",
    )
    .await?;

    format_financial_result(&result)
}

/// 资产负债表
#[tauri::command]
pub async fn stock_balance_sheet(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { years_ago_str(3) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "balancesheet",
        params,
        "ts_code,ann_date,f_ann_date,end_date,report_type,total_assets,total_liab,equity,parent_equity",
    )
    .await?;

    format_financial_result(&result)
}

/// 现金流量表
#[tauri::command]
pub async fn stock_cashflow(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { years_ago_str(3) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "cashflow",
        params,
        "ts_code,ann_date,f_ann_date,end_date,report_type,net_profit,operate_cash_inflow,invest_cash_inflow,finance_cash_inflow",
    )
    .await?;

    format_financial_result(&result)
}

/// 财务指标
#[tauri::command]
pub async fn stock_indicator(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { years_ago_str(3) } else { start_date };
    let params = json!({ "ts_code": ts_code, "start_date": effective_start, "end_date": effective_end });

    let result = tushare_http_call(
        &client,
        &token,
        "fina_indicator",
        params,
        "ts_code,ann_date,end_date,roe,roa,gross_profit_margin,net_profit_margin,eps,pe_ttm,pb",
    )
    .await?;

    format_financial_result(&result)
}

/// 业绩预告/快报
#[tauri::command]
pub async fn stock_forecast(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let effective_end = if end_date.is_empty() { today_str() } else { end_date };
    let effective_start = if start_date.is_empty() { years_ago_str(2) } else { start_date };
    let mut params = json!({ "start_date": effective_start, "end_date": effective_end });
    if !ts_code.is_empty() {
        params["ts_code"] = json!(ts_code);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "forecast",
        params,
        "ts_code,ann_date,end_date,type_,p_change_min,p_change_max",
    )
    .await?;

    format_table_result(&result)
}

/// 分红送股
#[tauri::command]
pub async fn stock_dividend(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "dividend",
        json!({ "ts_code": ts_code }),
        "ts_code,ann_date,end_date,div_proc,stk_div,stk_bo_rate,cash_div_tax",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 股东股本 API
// ─────────────────────────────────────────────────────────────────────────────

/// 流通股东
#[tauri::command]
pub async fn stock_float_holder(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "floatholder",
        json!({ "ts_code": ts_code }),
        "ts_code,ann_date,end_date,holder_name,hold_num,pct_float",
    )
    .await?;

    format_table_result(&result)
}

/// 十大流通股东
#[tauri::command]
pub async fn stock_top10_float_holder(ts_code: String, period: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !period.is_empty() {
        params["period"] = json!(period);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "top10_float_holder",
        params,
        "ts_code,ann_date,end_date,holder_name,hold_num,pct,change",
    )
    .await?;

    format_table_result(&result)
}

/// 股东人数
#[tauri::command]
pub async fn stock_float_holder_num(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "float_holder_num",
        params,
        "ts_code,ann_date,end_date,holder_num,float_share,avg_float_num",
    )
    .await?;

    format_table_result(&result)
}

/// 流通股本数据
#[tauri::command]
pub async fn stock_share_float(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !ts_code.is_empty() {
        params["ts_code"] = json!(ts_code);
    }
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "share_float",
        params,
        "ts_code,ann_date,end_date,total_share,float_share,free_share",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 资金流向 API
// ─────────────────────────────────────────────────────────────────────────────

/// 个股资金流向
#[tauri::command]
pub async fn stock_moneyflow(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "moneyflow",
        params,
        "ts_code,trade_date,buy_sm_amount,buy_sm_vol,buy_md_amount,buy_md_vol,buy_lg_amount,buy_lg_vol,buy_elg_amount,buy_elg_vol",
    )
    .await?;

    format_table_result(&result)
}

/// 北向资金流向（沪深港通）
#[tauri::command]
pub async fn stock_hsgt_top(search: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !search.is_empty() {
        params["search"] = json!(search);
    }
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "hsgt_top",
        params,
        "ts_code,name,close,pct_change,buy_amount,sell_amount,net_amount",
    )
    .await?;

    format_table_result(&result)
}

/// 北向资金每日持股明细（沪股通）
#[tauri::command]
pub async fn stock_hsgt_shanghai(start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "hsgt_top",
        params,
        "ts_code,name,close,pct_change,buy_amount,sell_amount,net_amount",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 交易数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 龙虎榜每日明细
#[tauri::command]
pub async fn stock_top_list(trade_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "top_list",
        json!({ "trade_date": trade_date }),
        "trade_date,ts_code,name,close,pct_change,turnover,amount,reason",
    )
    .await?;

    format_table_result(&result)
}

/// 龙虎榜机构明细
#[tauri::command]
pub async fn stock_top_inst(trade_date: String, ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !trade_date.is_empty() {
        params["trade_date"] = json!(trade_date);
    }
    if !ts_code.is_empty() {
        params["ts_code"] = json!(ts_code);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "top_inst",
        params,
        "trade_date,ts_code,name,buy_num,buy_amount,buy_rate,sell_num,sell_amount,sell_rate",
    )
    .await?;

    format_table_result(&result)
}

/// 大宗交易
#[tauri::command]
pub async fn stock_block_trade(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !ts_code.is_empty() {
        params["ts_code"] = json!(ts_code);
    }
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "block_trade",
        params,
        "ts_code,trade_date,close,price,pct_change,vol,amount,buyer,seller",
    )
    .await?;

    format_table_result(&result)
}

/// 融资融券每日明细
#[tauri::command]
pub async fn stock_margin_detail(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "margin_detail",
        params,
        "trade_date,ts_code,close,pct_change,margin_balance,余额,pct_change,short_balance",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 指数数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 指数日线
#[tauri::command]
pub async fn stock_index_daily(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "index_daily",
        params,
        "ts_code,trade_date,close,open,high,low,vol,amount,pct_change",
    )
    .await?;

    format_daily_result(&result)
}

/// 指数权重
#[tauri::command]
pub async fn stock_index_weight(index_code: String, trade_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let params = if !trade_date.is_empty() {
        json!({ "index_code": index_code, "trade_date": trade_date })
    } else {
        json!({ "index_code": index_code })
    };

    let result = tushare_http_call(
        &client,
        &token,
        "index_weight",
        params,
        "index_code,ts_code,in_date,out_date,weight",
    )
    .await?;

    format_table_result(&result)
}

/// 指数基本信息
#[tauri::command]
pub async fn stock_index_basic(ts_code: String, name: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !ts_code.is_empty() {
        params["ts_code"] = json!(ts_code);
    }
    if !name.is_empty() {
        params["name"] = json!(name);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "index_basic",
        params,
        "ts_code,name,fullname,market,pub_date,list_date,base_date,base_point",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 板块数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 行业板块
#[tauri::command]
pub async fn stock_board_industry(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    // 先获取股票所属行业
    let result = tushare_http_call(
        &client,
        &token,
        "stock_basic",
        json!({ "ts_code": ts_code, "fields": "ts_code,name,industry" }),
        "ts_code,name,industry",
    )
    .await?;

    format_table_result(&result)
}

/// 概念板块
#[tauri::command]
pub async fn stock_board_concept(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "concept",
        json!({ "id": ts_code }),
        "id,name,description",
    )
    .await?;

    format_table_result(&result)
}

/// 行业日行情
#[tauri::command]
pub async fn stock_industry_index(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "industry_index",
        params,
        "ts_code,trade_date,open,high,low,close,vol,amount,pct_change",
    )
    .await?;

    format_daily_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 新股数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 新股IPO
#[tauri::command]
pub async fn stock_new_share(start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({});
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "new_share",
        params,
        "ts_code,name,ipo_date,issue_date,listing_date,status,progress,issue_price,pct_change",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

/// 获取股票基本信息
#[tauri::command]
pub async fn stock_basic_info(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "stock_basic",
        json!({ "ts_code": ts_code }),
        "ts_code,symbol,name,area,industry,market,list_date",
    )
    .await?;

    format_table_result(&result)
}

/// 搜索股票
#[tauri::command]
pub async fn stock_search(keyword: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "stock_basic",
        json!({ "name": keyword }),
        "ts_code,symbol,name,industry,market",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 分笔数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 分笔数据（每日分笔明细）
#[tauri::command]
pub async fn stock_tick_data(ts_code: String, trade_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "tick_data",
        json!({ "ts_code": ts_code, "trade_date": trade_date }),
        "time,price,vol,amount,type",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 期货期权 API
// ─────────────────────────────────────────────────────────────────────────────

/// 期货日线行情
#[tauri::command]
pub async fn stock_future_daily(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "fut_daily",
        params,
        "ts_code,trade_date,open,high,low,close,vol,amount,oi",
    )
    .await?;

    format_table_result(&result)
}

/// 期权日线行情
#[tauri::command]
pub async fn stock_option_daily(ts_code: String, start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();
    let mut params = json!({ "ts_code": ts_code });
    if !start_date.is_empty() {
        params["start_date"] = json!(start_date);
    }
    if !end_date.is_empty() {
        params["end_date"] = json!(end_date);
    }

    let result = tushare_http_call(
        &client,
        &token,
        "opt_daily",
        params,
        "ts_code,trade_date,open,high,low,close,vol,amount,iv",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 宏观数据 API
// ─────────────────────────────────────────────────────────────────────────────

/// 国内生产总值（GDP）
#[tauri::command]
pub async fn stock_gdp(quarter: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "gdp",
        json!({ "quarter": quarter }),
        "quarter,gdp_c,GDP,gnp,first_value,second_value,third_value",
    )
    .await?;

    format_table_result(&result)
}

/// 居民消费价格指数（CPI）
#[tauri::command]
pub async fn stock_cpi(month: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "cpi",
        json!({ "month": month }),
        "month,cpi_month,cpi_year,cpi_ppi,cpi_food,cpi_consumer",
    )
    .await?;

    format_table_result(&result)
}

/// 货币供应量
#[tauri::command]
pub async fn stock_money_supply(month: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "money_supply",
        json!({ "month": month }),
        "month,m0,m1,m2,同比增长",
    )
    .await?;

    format_table_result(&result)
}

/// 货币供应量余额
#[tauri::command]
pub async fn stock_money_supply_bal(month: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "money_supply_bal",
        json!({ "month": month }),
        "month,m0,m1,m2",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 概念板块 API
// ─────────────────────────────────────────────────────────────────────────────

/// 概念板块成分股
#[tauri::command]
pub async fn stock_concept_detail(ts_code: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "concept_detail",
        json!({ "id": ts_code }),
        "id,name,ts_code",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 北向资金补充 API
// ─────────────────────────────────────────────────────────────────────────────

/// 北向资金深股通每日持股明细
#[tauri::command]
pub async fn stock_hsgt_shenzhen(start_date: String, end_date: String) -> Result<Value, String> {
    let token = get_tushare_token()?;
    let client = Client::new();

    let result = tushare_http_call(
        &client,
        &token,
        "hsgt_top10",
        json!({ "hsgt_type": "SZ", "start_date": start_date, "end_date": end_date }),
        "ts_code,trade_date,raw_ts_code,name,close,pct_change,vol,amount",
    )
    .await?;

    format_table_result(&result)
}

// ─────────────────────────────────────────────────────────────────────────────
// 格式化函数
// ─────────────────────────────────────────────────────────────────────────────

fn format_daily_result(data: &Value) -> Result<Value, String> {
    let fields = data
        .get("fields")
        .and_then(|f| f.as_array())
        .ok_or("缺少 fields 字段")?;
    let items = data
        .get("items")
        .and_then(|i| i.as_array())
        .ok_or("缺少 items 字段")?;

    let mut rows: Vec<Value> = Vec::new();
    for item in items {
        if let Some(arr) = item.as_array() {
            let mut row = serde_json::Map::new();
            for (idx, field) in fields.iter().enumerate() {
                if let Some(val) = arr.get(idx) {
                    row.insert(
                        field.as_str().unwrap_or("").to_string(),
                        val.clone(),
                    );
                }
            }
            rows.push(json!(row));
        }
    }

    Ok(json!({
        "data": rows,
        "count": rows.len(),
        "fields": fields
    }))
}

fn format_table_result(data: &Value) -> Result<Value, String> {
    format_daily_result(data)
}

fn format_financial_result(data: &Value) -> Result<Value, String> {
    format_daily_result(data)
}

fn format_realtime_result(data: &Value) -> Result<Value, String> {
    format_daily_result(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具定义（供 tools.rs 调用）
// ─────────────────────────────────────────────────────────────────────────────

use crate::tools::{ToolDefinition, ToolCall, ToolResult};

/// 股票研究侧栏 `toolScope: stock` 使用的精简工具集（降低 token 与误调用概率）。
/// 宏观数据、期货期权、分笔等见 `get_stock_tool_definitions_full`。
pub fn get_stock_tool_definitions() -> Vec<ToolDefinition> {
    stock_tool_definitions_common()
}

/// 与通用文档工具合并时使用（含宏观/衍生品/分笔等）。
pub fn get_stock_tool_definitions_full() -> Vec<ToolDefinition> {
    let mut v = stock_tool_definitions_common();
    v.extend(stock_tool_definitions_macro_and_derivatives());
    v
}

/// `toolScope: stock:financial` — 财报、指标、股东等（不含指数/概念行情工具）
pub fn get_stock_tool_definitions_financial() -> Vec<ToolDefinition> {
    const NAMES: &[&str] = &[
        "stock_search",
        "stock_basic_info",
        "stock_income",
        "stock_balance_sheet",
        "stock_cashflow",
        "stock_indicator",
        "stock_forecast",
        "stock_dividend",
        "stock_float_holder",
        "stock_top10_float_holder",
        "stock_float_holder_num",
        "stock_share_float",
        "stock_board_industry",
    ];
    filter_stock_tools_by_names(stock_tool_definitions_common(), NAMES)
}

/// `toolScope: stock:technical` — K 线、实时、资金盘面、指数/板块行情等
pub fn get_stock_tool_definitions_technical() -> Vec<ToolDefinition> {
    const NAMES: &[&str] = &[
        "stock_search",
        "stock_basic_info",
        "stock_daily",
        "stock_weekly",
        "stock_monthly",
        "stock_realtime_quote",
        "stock_price_limit",
        "stock_suspend_d",
        "stock_adj_factor",
        "stock_moneyflow",
        "stock_hsgt_top",
        "stock_hsgt_shanghai",
        "stock_hsgt_shenzhen",
        "stock_top_list",
        "stock_top_inst",
        "stock_block_trade",
        "stock_margin_detail",
        "stock_index_daily",
        "stock_index_weight",
        "stock_index_basic",
        "stock_board_concept",
        "stock_industry_index",
        "stock_concept_detail",
        "stock_new_share",
    ];
    filter_stock_tools_by_names(stock_tool_definitions_common(), NAMES)
}

fn filter_stock_tools_by_names(common: Vec<ToolDefinition>, allow: &[&str]) -> Vec<ToolDefinition> {
    let set: HashSet<&str> = allow.iter().copied().collect();
    common
        .into_iter()
        .filter(|t| set.contains(t.function.name.as_str()))
        .collect()
}

fn stock_tool_definitions_common() -> Vec<ToolDefinition> {
    vec![
        tool_def("stock_basic_info", "获取股票基本信息（名称、上市日期、行业、股本等）", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "股票代码（如 000001.SZ）" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_daily", "获取股票日线行情（开盘、收盘、最高、最低、成交量、成交额）。不传日期则自动返回近60天数据。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "股票代码（如 000001.SZ）" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD，建议传近期日期如今日60天前" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日日期" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_weekly", "获取股票周线行情。不传日期则自动返回近180天数据。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日日期" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_monthly", "获取股票月线行情。不传日期则自动返回近2年数据。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日日期" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_realtime_quote", "获取股票实时行情（当日分时数据）", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_price_limit", "获取每日涨跌停价格", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "trade_date": { "type": "string", "description": "交易日期" }
            }
        })),
        tool_def("stock_suspend_d", "获取停复牌数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "suspend_date": { "type": "string" },
                "resume_date": { "type": "string" }
            }
        })),
        tool_def("stock_adj_factor", "获取复权因子", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_income", "获取利润表数据（营业收入、净利润等）。不传日期则自动返回近3年数据，建议传 start_date 和 end_date 缩小范围。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD，如3年前" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_balance_sheet", "获取资产负债表数据。不传日期则自动返回近3年数据。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_cashflow", "获取现金流量表数据。不传日期则自动返回近3年数据。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_indicator", "获取财务指标（ROE、ROA、毛利率、净利率等）。不传日期则自动返回近3年数据。", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string", "description": "开始日期 YYYYMMDD" },
                "end_date": { "type": "string", "description": "结束日期 YYYYMMDD，建议传今日" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_forecast", "获取业绩预告/快报", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
        tool_def("stock_dividend", "获取分红送股数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_float_holder", "获取流通股东数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_top10_float_holder", "获取十大流通股东数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "period": { "type": "string", "description": "报告期（如 20220930）" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_float_holder_num", "获取股东人数变化", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_share_float", "获取流通股本数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
        tool_def("stock_moneyflow", "获取个股资金流向（主力/散户资金）", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_hsgt_top", "获取北向资金持股排行", json!({
            "type": "object",
            "properties": {
                "search": { "type": "string", "description": "股票名称或代码" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
        tool_def("stock_hsgt_shanghai", "获取北向资金沪股通每日持股明细", json!({
            "type": "object",
            "properties": {
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
        tool_def("stock_top_list", "获取龙虎榜每日明细", json!({
            "type": "object",
            "properties": {
                "trade_date": { "type": "string", "description": "交易日期（如 20231001）" }
            },
            "required": ["trade_date"]
        })),
        tool_def("stock_top_inst", "获取龙虎榜机构明细", json!({
            "type": "object",
            "properties": {
                "trade_date": { "type": "string" },
                "ts_code": { "type": "string" }
            }
        })),
        tool_def("stock_block_trade", "获取大宗交易数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
        tool_def("stock_margin_detail", "获取融资融券每日明细", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_index_daily", "获取指数日线数据", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "指数代码（如 000001.SH 上证指数）" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_index_weight", "获取指数成分股权重", json!({
            "type": "object",
            "properties": {
                "index_code": { "type": "string" },
                "trade_date": { "type": "string" }
            },
            "required": ["index_code"]
        })),
        tool_def("stock_index_basic", "获取指数基本信息", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "name": { "type": "string" }
            }
        })),
        tool_def("stock_board_industry", "获取股票所属行业信息", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_board_concept", "获取概念板块信息", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "概念板块代码" }
            }
        })),
        tool_def("stock_industry_index", "获取行业日行情", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_new_share", "获取新股IPO数据", json!({
            "type": "object",
            "properties": {
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
        tool_def("stock_search", "搜索股票（按名称或代码）", json!({
            "type": "object",
            "properties": {
                "keyword": { "type": "string", "description": "搜索关键词" }
            },
            "required": ["keyword"]
        })),
        tool_def("stock_concept_detail", "获取概念板块成分股", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "概念板块代码" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_hsgt_shenzhen", "获取北向资金深股通每日持股明细", json!({
            "type": "object",
            "properties": {
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            }
        })),
    ]
}

/// 宏观、期货期权、分笔等低频工具，仅 `get_stock_tool_definitions_full` 合并使用。
fn stock_tool_definitions_macro_and_derivatives() -> Vec<ToolDefinition> {
    vec![
        tool_def("stock_tick_data", "获取分笔数据（每日分笔明细）", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string" },
                "trade_date": { "type": "string", "description": "交易日期" }
            },
            "required": ["ts_code", "trade_date"]
        })),
        tool_def("stock_future_daily", "获取期货日线行情", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "期货代码" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_option_daily", "获取期权日线行情", json!({
            "type": "object",
            "properties": {
                "ts_code": { "type": "string", "description": "期权代码" },
                "start_date": { "type": "string" },
                "end_date": { "type": "string" }
            },
            "required": ["ts_code"]
        })),
        tool_def("stock_gdp", "获取国内生产总值（GDP）数据", json!({
            "type": "object",
            "properties": {
                "quarter": { "type": "string", "description": "季度（如 202201）" }
            }
        })),
        tool_def("stock_cpi", "获取居民消费价格指数（CPI）", json!({
            "type": "object",
            "properties": {
                "month": { "type": "string", "description": "月份（如 202301）" }
            }
        })),
        tool_def("stock_money_supply", "获取货币供应量数据", json!({
            "type": "object",
            "properties": {
                "month": { "type": "string", "description": "月份（如 202301）" }
            }
        })),
        tool_def("stock_money_supply_bal", "获取货币供应量余额数据", json!({
            "type": "object",
            "properties": {
                "month": { "type": "string", "description": "月份（如 202301）" }
            }
        })),
    ]
}

// 注意：tushare_token_check / store_tushare_credential / delete_tushare_credential
// 属于凭证管理操作，不暴露给 AI Function Calling，仅通过 Tauri command 直接调用

fn tool_def(name: &str, description: &str, parameters: Value) -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: crate::tools::FunctionDefinition {
            name: name.to_string(),
            description: description.to_string(),
            parameters,
        },
    }
}

/// 单条工具结果写入对话时的最大字符数（避免挤爆模型上下文）
const STOCK_TOOL_CONTENT_MAX_CHARS_DEFAULT: usize = 10_000;
const STOCK_TOOL_CONTENT_MAX_CHARS_SERIES: usize = 12_000;
const STOCK_TOOL_CONTENT_MAX_CHARS_TICK: usize = 4_000;

fn truncate_stock_tool_result_content(content: String, tool_name: &str) -> String {
    let max_chars = match tool_name {
        "stock_tick_data" => STOCK_TOOL_CONTENT_MAX_CHARS_TICK,
        "stock_daily" | "stock_weekly" | "stock_monthly" | "stock_moneyflow" | "stock_adj_factor"
        | "stock_float_holder_num" | "stock_block_trade" | "stock_margin_detail" => {
            STOCK_TOOL_CONTENT_MAX_CHARS_SERIES
        }
        _ => STOCK_TOOL_CONTENT_MAX_CHARS_DEFAULT,
    };
    let n = content.chars().count();
    if n <= max_chars {
        return content;
    }
    let head: String = content.chars().take(max_chars).collect();
    format!(
        "{head}\n\n[truncated: showing first {max_chars} chars of {n} total for tool {tool_name}]"
    )
}

/// 执行股票工具调用
pub async fn execute_stock_tool(tool_call: &ToolCall) -> ToolResult {
    let args = &tool_call.function.arguments;
    let args_parsed: Value = serde_json::from_str(args).unwrap_or(json!({}));

    let result_content = match tool_call.function.name.as_str() {
        "stock_basic_info" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_basic_info(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_daily" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_daily(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_weekly" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_weekly(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_monthly" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_monthly(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_realtime_quote" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_realtime_quote(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_price_limit" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let trade_date = args_parsed.get("trade_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_price_limit(ts_code.to_string(), trade_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_suspend_d" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let suspend_date = args_parsed.get("suspend_date").and_then(|v| v.as_str()).unwrap_or("");
            let resume_date = args_parsed.get("resume_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_suspend_d(ts_code.to_string(), suspend_date.to_string(), resume_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_adj_factor" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_adj_factor(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_income" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_income(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_balance_sheet" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_balance_sheet(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_cashflow" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_cashflow(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_indicator" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_indicator(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_forecast" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_forecast(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_dividend" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_dividend(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_float_holder" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_float_holder(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_top10_float_holder" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let period = args_parsed.get("period").and_then(|v| v.as_str()).unwrap_or("");
            stock_top10_float_holder(ts_code.to_string(), period.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_float_holder_num" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_float_holder_num(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_share_float" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_share_float(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_moneyflow" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_moneyflow(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_hsgt_top" => {
            let search = args_parsed.get("search").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_hsgt_top(search.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_hsgt_shanghai" => {
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_hsgt_shanghai(start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_top_list" => {
            let trade_date = args_parsed.get("trade_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_top_list(trade_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_top_inst" => {
            let trade_date = args_parsed.get("trade_date").and_then(|v| v.as_str()).unwrap_or("");
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_top_inst(trade_date.to_string(), ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_block_trade" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_block_trade(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_margin_detail" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_margin_detail(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_index_daily" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_index_daily(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_index_weight" => {
            let index_code = args_parsed.get("index_code").and_then(|v| v.as_str()).unwrap_or("");
            let trade_date = args_parsed.get("trade_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_index_weight(index_code.to_string(), trade_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_index_basic" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let name = args_parsed.get("name").and_then(|v| v.as_str()).unwrap_or("");
            stock_index_basic(ts_code.to_string(), name.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_board_industry" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_board_industry(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_board_concept" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_board_concept(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_industry_index" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_industry_index(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_new_share" => {
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_new_share(start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_search" => {
            let keyword = args_parsed.get("keyword").and_then(|v| v.as_str()).unwrap_or("");
            stock_search(keyword.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_tick_data" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let trade_date = args_parsed.get("trade_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_tick_data(ts_code.to_string(), trade_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_future_daily" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_future_daily(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_option_daily" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_option_daily(ts_code.to_string(), start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_gdp" => {
            let quarter = args_parsed.get("quarter").and_then(|v| v.as_str()).unwrap_or("");
            stock_gdp(quarter.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_cpi" => {
            let month = args_parsed.get("month").and_then(|v| v.as_str()).unwrap_or("");
            stock_cpi(month.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_money_supply" => {
            let month = args_parsed.get("month").and_then(|v| v.as_str()).unwrap_or("");
            stock_money_supply(month.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_money_supply_bal" => {
            let month = args_parsed.get("month").and_then(|v| v.as_str()).unwrap_or("");
            stock_money_supply_bal(month.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_concept_detail" => {
            let ts_code = args_parsed.get("ts_code").and_then(|v| v.as_str()).unwrap_or("");
            stock_concept_detail(ts_code.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "stock_hsgt_shenzhen" => {
            let start_date = args_parsed.get("start_date").and_then(|v| v.as_str()).unwrap_or("");
            let end_date = args_parsed.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            stock_hsgt_shenzhen(start_date.to_string(), end_date.to_string()).await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "tushare_token_check" => {
            tushare_token_check().await
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "store_tushare_credential" => {
            let token = args_parsed.get("token").and_then(|v| v.as_str()).unwrap_or("");
            store_tushare_credential(token.to_string())
                .map(|s| json!({ "success": true, "message": s }).to_string())
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        "delete_tushare_credential" => {
            delete_tushare_credential()
                .map(|s| json!({ "success": true, "message": s }).to_string())
                .map(|v| v.to_string()).unwrap_or_else(|e| json!({ "error": e }).to_string())
        }
        _ => json!({ "error": format!("未知股票工具: {}", tool_call.function.name) }).to_string(),
    };

    let tool_name = tool_call.function.name.as_str();
    ToolResult {
        tool_call_id: tool_call.id.clone(),
        role: "tool".to_string(),
        content: truncate_stock_tool_result_content(result_content, tool_name),
    }
}
