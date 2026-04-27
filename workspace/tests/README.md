# tests

> 前端测试根目录, 镜像 `workspace/src/` 结构. E2E 单独放 `e2e/`, mockIPC handlers 集中在 `mocks/`.

## 文件清单

| 文件 / 目录       | 说明                                |
| ----------------- | ----------------------------------- |
| setup.ts          | Vitest 全局 setup (testing-library 匹配器) |
| mocks/            | mockIPC handlers, 按模块拆文件      |
| e2e/              | Playwright + tauri-driver E2E 用例  |

## 约定

- 测试文件统一 `<src 镜像路径>/<name>.test.ts(x)`
- 引用业务代码用 `@/` 别名, 不要写相对路径
- 每条 `@rules` 一个 `it()`, 详见 `.claude/rules/testing.md`
