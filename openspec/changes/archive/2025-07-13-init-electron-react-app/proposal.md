# Proposal: Init Electron + React App

## Problem

当前仓库为空，需要从零初始化一个具备生产发布能力的 Electron 桌面应用项目。  
参考项目 `hades-pdd-electron` 已验证了 `electron-builder` + `electron-updater` + `generic provider` 的打包与自动更新链路，但其使用 webpack 多配置方案，构建体验偏重。

## Goals

- 建立一套使用 pnpm + Vite + React + TypeScript 的现代 Electron 单包项目结构
- 保留参考项目中经过验证的 `electron-builder` + `electron-updater` 打包/更新方案
- 主进程（main）与预加载（preload）独立手工构建，渲染进程（renderer）使用 Vite 构建
- Windows 首版支持（NSIS 安装包），macOS 配置预留
- 更新源使用 `generic` provider，地址通过环境变量注入
- 提供完整的开发/构建/打包脚本，开箱即用

## Non-Goals

- 不做 pnpm workspace 多包结构
- 不引入 antd、状态管理等业务依赖（纯脚手架层）
- 不在首版完成 macOS 签名/公证链路
- 不复刻参考项目中业务相关逻辑（账号、请求、轮询等）

## Stakeholders

- 开发者：使用此脚手架作为后续功能开发的起点
