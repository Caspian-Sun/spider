//! @description frontmatter 解析工具：从 .md 文件提取 YAML frontmatter 和正文
//! @module src-tauri/scan/parser
//! @dependencies gray_matter, serde_yaml
//! @prd docs/prds/claude-workflow-kanban.md#文件扫描
//! @task docs/tasks/tasks-claude-workflow-kanban-2026-04-28.json#T008
//! @rules
//!   - Command 无 frontmatter 时降级: id = 文件名, title = 文件首个 # 标题, idx = null, helper = true
//!   - 解析失败的单个文件不阻断整个扫描, 错误记入 scan_errors 数组

use gray_matter::{Matter, engine::YAML};
use serde::Deserialize;

/// 原始 command frontmatter 结构（允许所有字段缺失）
#[derive(Deserialize, Debug, Default)]
pub struct CommandFrontmatter {
    pub id:      Option<String>,
    pub cmd:     Option<String>,
    pub idx:     Option<u32>,
    pub title:   Option<String>,
    pub desc:    Option<String>,
    pub inputs:  Option<Vec<String>>,
    pub outputs: Option<Vec<String>>,
    pub gate:    Option<String>,
    pub helper:  Option<bool>,
}

/// 原始 rule frontmatter
#[derive(Deserialize, Debug, Default)]
pub struct RuleFrontmatter {
    pub id:       Option<String>,
    pub priority: Option<String>,
    pub title:    Option<String>,
    pub desc:     Option<String>,
    pub lanes:    Option<Vec<String>>,
}

/// 原始 PRD frontmatter
#[derive(Deserialize, Debug, Default)]
pub struct PrdFrontmatter {
    pub id:         Option<String>,
    pub title:      Option<String>,
    pub status:     Option<String>,
    pub author:     Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    pub summary:    Option<String>,
}

/// 解析 markdown 文件，返回 (frontmatter_yaml_str, body)
pub fn parse_md(content: &str) -> (Option<String>, String) {
    let matter = Matter::<YAML>::new();
    match matter.parse::<serde_yaml::Value>(content) {
        Ok(result) => {
            let fm_str = result.data.as_ref().map(|v| {
                serde_yaml::to_string(v).unwrap_or_default()
            });
            (fm_str, result.content)
        }
        Err(_) => (None, content.to_string()),
    }
}

/// 从 body 中提取第一个 # 标题
pub fn extract_first_h1(body: &str) -> Option<String> {
    body.lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").trim().to_string())
}

/// 计算正文中 [TBD] 出现次数
pub fn count_tbd(body: &str) -> u32 {
    let mut count = 0u32;
    let mut search = body;
    while let Some(pos) = search.find("[TBD]") {
        count += 1;
        search = &search[pos + 5..];
    }
    count
}

/// 尝试将 frontmatter yaml 字符串反序列化为指定类型；失败返回 Default
pub fn try_parse_fm<T: for<'de> Deserialize<'de> + Default>(yaml: &str) -> T {
    serde_yaml::from_str(yaml).unwrap_or_default()
}

// ─── 单元测试 ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r1_missing_frontmatter_returns_empty_body() {
        let (fm, body) = parse_md("# Hello\ncontent");
        assert!(fm.is_none());
        assert!(body.contains("Hello"));
    }

    #[test]
    fn r2_count_tbd_counts_occurrences() {
        let body = "start [TBD] middle [TBD] end";
        assert_eq!(count_tbd(body), 2);
    }

    #[test]
    fn r3_extract_first_h1_returns_title() {
        let body = "# My Title\nsome content";
        assert_eq!(extract_first_h1(body), Some("My Title".to_string()));
    }
}
