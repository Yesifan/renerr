---
name: Renarr
description: 深色自托管媒体库管理台，用于扫描、匹配、整理和核对 WebDAV 影视库。
colors:
  background: "#0d1017"
  foreground: "#e7eaf0"
  card: "#0f172a"
  card-foreground: "#f8fafc"
  popover: "#0f172a"
  popover-foreground: "#f8fafc"
  muted: "#1e293b"
  muted-foreground: "#94a3b8"
  accent: "#1e293b"
  accent-foreground: "#f8fafc"
  border: "#334155"
  input: "#0f172a"
  ring: "#22d3ee"
  primary: "#22d3ee"
  primary-foreground: "#020617"
  secondary: "#1e293b"
  secondary-foreground: "#f8fafc"
  destructive: "#f87171"
  sidebar: "#0d1017"
  sidebar-foreground: "#e7eaf0"
  sidebar-accent: "#1e293b"
  sidebar-accent-foreground: "#f8fafc"
  sidebar-border: "#334155"
  sidebar-ring: "#22d3ee"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "20px"
  "4xl": "32px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.4xl}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.4xl}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.4xl}"
    padding: "4px 12px"
    height: "36px"
---

# Design System: Renarr

## 1. Overview

**Creative North Star: "暗室编目台"**

Renarr 的界面应像一张深色暗室里的编目台：用户面对的是远端片库的真实目录、状态、任务和风险动作，而不是消费型媒体首页。系统可以有影视资料感，尤其在海报卡、片名、年份、剧集信息和文件摘要上，但视觉重心始终是整理、核对和确认。

整体气质是深色、稳定、资料化、可长期使用。主色 `primary` 只用于主要行动、当前选择、焦点和少量可操作状态，不作为装饰色铺满界面。界面拒绝流媒体娱乐化、营销页、炫技动效、装饰卡片和没有真实后端持久化的假控制台。

**Key Characteristics:**
- 深色管理台，面板分层清楚，长时间使用不刺眼。
- 影视资料馆感来自真实媒体内容，不来自花哨装饰。
- 左侧导航、设置表单、任务表、日志表和媒体卡使用同一组件词汇。
- 操作要能追溯到后端状态，危险动作必须让用户看清影响范围。
- 密度服务于重复管理任务，避免首页式大留白和营销式叙事。

## 2. Colors

Renarr 使用受控的深色 slate 系列和一个清晰的 cyan 主行动色。颜色命名保持技术化，以便工程和设计对齐。

### Primary

- **primary**: 主行动、焦点、当前选择、重要链接和执行型操作。它的稀缺性就是层级，不允许扩展成装饰渐变。
- **primary-foreground**: 主行动按钮上的深色文字，用于保证 cyan 背景上的可读性。
- **ring**: 焦点环和交互状态提示，应与 `primary` 保持一致。

### Neutral

- **background**: 应用最底层背景，包含顶栏和整体页面底色。
- **sidebar**: 左侧导航底色，当前与 `background` 一致，确保导航像固定工具架而不是浮动卡片。
- **muted**: 主内容区和次级表面背景，用于把页面从应用底色中分离出来。
- **card / popover / input**: 表单、面板、弹层和输入控件的深色容器层。
- **foreground / card-foreground / popover-foreground**: 主要文字，不要用 muted 色替代正文。
- **muted-foreground**: 说明、辅助信息、时间、数量和空状态文案。
- **border / sidebar-border**: 分隔、表格行、面板 ring 和导航层级。

### Tertiary

- **destructive**: 错误、危险动作和失败状态。只用于语义状态，不用于一般强调。
- **secondary / accent**: 二级按钮、hover、选中导航和轻量状态背景。

### Named Rules

**The ≤10% Accent Rule.** `primary` 在单个屏幕中的面积应保持在 10% 以下。它用于行动和状态，不用于装饰。

**The Real Status Rule.** 状态色必须对应真实状态：失败、待审核、运行、成功、待整理。不要为了“丰富页面”添加没有业务含义的颜色。

## 3. Typography

**Display Font:** Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Body Font:** Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Label/Mono Font:** 不使用独立 mono 字体；文件路径和 ID 仍保持系统 sans，必要时用表格截断和 tooltip 承载完整值。

**Character:** 单一 sans 字体让界面保持工具属性。字号尺度固定，不使用流式 hero 字体；页面标题、卡片标题、表格和控件都服务于扫描和比较。

### Hierarchy

- **Display** (600, 1.5rem, 1.33): 页面标题，如媒体库、媒体管理、任务队列。不要扩大成 landing-page hero。
- **Headline** (600, 1.25rem, 1.4): 复杂面板或重要空状态标题，少用。
- **Title** (500, 1rem, 1.5): 卡片标题、SectionPanel 标题、弹窗标题。
- **Body** (400, 0.875rem, 1.5): 表单、表格、说明和普通 UI 文本。
- **Label** (500, 0.75rem, 1.33): Badge、辅助标签、表格紧凑信息和导航子项。

### Named Rules

**The No Hero Type Rule.** Renarr 是管理台，不是宣传页。任何超过 `text-2xl` 的 UI 标题都必须有明确的信息架构理由。

**The Data First Rule.** 长路径、片名和错误信息优先保持可扫描；使用截断、换行和详情面板，不用大字号强行展示。

## 4. Elevation

Renarr 的深度主要来自 tonal layering：底层 `background`、内容区 `muted`、面板 `card`、浮层 `popover`，再用 `border` 或 `ring` 划清边界。阴影只用于浮层、sheet、select content 等脱离文档流的组件；常驻面板不靠大阴影表达层级。

### Shadow Vocabulary

- **surface-ring** (`ring: 1px solid color-mix(in srgb, var(--color-foreground) 10%, transparent)`): Card 和 Dialog 的默认边界。
- **popover-shadow** (`shadow-2xl`): Select、tooltip 和浮层菜单，用来说明它们覆盖在当前任务之上。
- **sheet-shadow** (`shadow-lg`): Sheet 抽屉进入时使用，配合边框指示方向。

### Named Rules

**The Tonal Layer Rule.** 常驻内容用背景深浅和 1px 边界分层，禁止用宽模糊投影制造卡片感。

**The Floating Only Rule.** 阴影只属于浮层；页面内的 SectionPanel、表格和媒体卡默认保持平面。

## 5. Components

组件语言来自 shadcn-svelte 和当前 maia 风格：圆润、深色、可聚焦、状态明确。未来媒体化增强应集中在海报卡、详情面板和文件核对区域，不应破坏设置、表格和任务流的一致性。

### Buttons

- **Shape:** pill 形按钮，使用大圆角 (`rounded-4xl`, 约 32px)。
- **Primary:** `primary` 背景、`primary-foreground` 文字，高度 36px，默认用于保存、扫描、提交、添加入口。
- **Hover / Focus:** hover 使用同色透明度变化；focus 使用 `ring` 的 3px 可见焦点环。
- **Secondary / Ghost / Tertiary:** outline 使用 `input/30` 背景和 `border` 边界；ghost 只在导航、工具按钮和低风险操作中使用。

### Chips

- **Style:** Badge 高度约 20px，圆角 pill，字体 12px，保持紧凑。
- **State:** 业务状态使用轻量 tint 背景：失败 red、待审核 amber、运行 sky、成功 emerald、未知 slate。状态文字不能只靠颜色表达。

### Cards / Containers

- **Corner Style:** 常驻卡片使用圆润面板 (`rounded-2xl`, 约 20px)，内部小统计块可用 `rounded-xl`。
- **Background:** `card` 面板放在 `muted` 内容区上，海报缺失区域使用 `muted`。
- **Shadow Strategy:** 常驻卡片不用阴影，使用 1px ring 或 border。选中媒体卡使用 `ring-2 ring-primary/50`。
- **Border:** SectionPanel 的 header 用 `border-b border-border` 分隔操作区和内容区。
- **Internal Padding:** 常规面板 24px，小型媒体卡内容 12px。

### Inputs / Fields

- **Style:** 输入框、Select trigger 使用 `input/30` 背景、`border-input`、pill 圆角、高度 36px。
- **Focus:** 使用 `border-ring` 和 `ring-ring/50` 的 3px 焦点环，不用自定义发光。
- **Error / Disabled:** error 使用 `destructive` 边界和 ring；disabled 降低透明度且取消 pointer。

### Navigation

- **Style:** 顶栏固定在桌面端，左侧导航宽 260px，深色 sidebar 与应用底色一致。
- **Typography:** 主项 14px，子项 12-14px，当前项使用 `sidebar-accent` 背景和 medium 字重。
- **Default / Hover / Active:** hover 和 active 使用同一 slate accent 层，避免高饱和色铺满导航。
- **Mobile Treatment:** 顶栏可换行，sidebar 在窄屏回到文档流，保持路径入口可见。

### Dialogs / Sheets

- **Style:** 添加类操作使用 Dialog；修改类操作留在原位置内联保存。
- **Surface:** `popover` 背景、`popover-foreground` 文字、ring 边界，overlay 为 `black/80`。
- **Motion:** 100-200ms 的 fade/zoom/slide，表达打开关闭状态，不做页面编舞。

### Media Item Card

- **Style:** 这是 Renarr 最主要的媒体化组件。海报占比 2:3，内容区紧凑显示标题、年份、视频数量和状态。
- **Missing Poster:** 用 `muted` 背景和“文件夹 / 视频文件”文本占位，不使用抽象插画。
- **Selected State:** 使用 `primary/50` ring，而不是改整张卡片背景。
- **Inline Work:** pending 或 failed 条目可在卡片内显示手动匹配入口；这属于任务上下文，不应升级成独立页面。

### Tables

- **Style:** 表格用于任务、日志、文件列表和设置对象。行高克制，hover 使用 `muted/50`。
- **Content:** 路径、错误和长文件名优先截断并保留详情入口，不挤压操作按钮。
- **State:** loading 使用 Skeleton；空表格使用 Empty 组件说明下一步。

## 6. Do's and Don'ts

### Do:

- **Do** 使用 shadcn-svelte 组件作为基础控件，局部视觉差异通过页面级 class 或项目组件封装。
- **Do** 让 `primary` 只出现在主要行动、焦点、选中和重要链接上。
- **Do** 让海报、片名、年份和文件统计承担影视资料馆感。
- **Do** 在列表里用 Switch、Checkbox、Badge 和 Button 表达真实可操作状态。
- **Do** 在添加 WebDAV source、Library Path 等对象时使用 Dialog。
- **Do** 在修改设置和整理计划时保持内联编辑，并提供明确保存或提交按钮。
- **Do** 用 tonal layering 和 1px 边界组织页面，不用装饰阴影堆叠常驻卡片。

### Don't:

- **Don't** 把 Renarr 做成以播放和推荐为中心的流媒体娱乐应用。
- **Don't** 做营销介绍、巨幅 hero、装饰卡片或首页式价值主张区。
- **Don't** 使用炫技动效、强烈渐变、gradient text、glassmorphism 或无业务含义的装饰色。
- **Don't** 把添加表单、配置入口和危险操作长期堆在内容卡片里。
- **Don't** 做只在前端临时切换、没有真实后端持久化的假控制台。
- **Don't** 在常驻 Card 上同时使用 1px 边框和大模糊阴影。
- **Don't** 用纯文本“开启 / 关闭”代替二值设置控件。
