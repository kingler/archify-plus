# 企业架构模型：一个模型画出 ArchiMate、BPMN 与 UML

<span id="answer" class="section-anchor" aria-hidden="true"></span>

## 先说结论

Archify Enterprise 把元素和关系保存在**一份类型化 JSON 模型**里，再画成多种视图：ArchiMate 视点、BPMN 流程，以及 UML 的活动图、状态机、时序图、用例图、类图、组件图和部署图。所有视图使用同一套视觉语言，同一个元素无论出现在哪里，样子都一样。

同一份模型还能生成代码和交付计划。它自 v3.3.0 起随 Archify Skill 一起分发，位于 `enterprise/` 目录，除 Node.js 18 外没有其他依赖。

它是建模与生成层，不是托管的模型仓库，也不是绘图工具。模型由你或你的 Agent 编写，Archify 负责校验、绘制和生成。

<span id="views" class="section-anchor" aria-hidden="true"></span>

## 一个仓库，九种视图

每个元素在模型中只存在一份。视图把元素放在行列网格上，与 Archify 原生图表的布局约定相同，并自动画出两端都在该视图中的关系。

| 视图类型 | 适用场景 |
| --- | --- |
| `archimate` | 分层、应用协作、动机、技术与迁移等视点 |
| `bpmn` | 带泳道、事件、各类任务和网关的流程 |
| `activity` | 带判断、分叉与汇合的 UML 活动图 |
| `state` | 状态机 |
| `sequence` | 生命线、消息与片段 |
| `usecase` | 参与者、用例与系统边界 |
| `class` | 带属性、方法和多重性的类图 |
| `component` | 组件、包及其依赖 |
| `deployment` | 节点、执行环境与制品 |

内置示例是一个虚构的订单到回款平台，包含 100 个元素和 14 个视图。

<span id="language" class="section-anchor" aria-hidden="true"></span>

## 同一套视觉语言

每种元素和每种关系的样式都只在一份目录中定义，因此不会在不同图表类型之间走样。

**颜色表示架构层。** 映射沿用 ArchiMate 的惯例，并落在 Archify 固定的调色板上：

| 层 | 颜色 |
| --- | --- |
| 动机 | 紫色 |
| 战略 | 橙色 |
| 业务 | 琥珀色 |
| 应用 | 青色 |
| 技术 | 绿色 |
| 实施与迁移 | 玫红色 |
| 其他、外部参与者 | 灰蓝色 |

**形状表示角色。** 直角表示主动结构（谁或什么在执行）；圆角表示行为（执行了什么）；带顶部横线表示被动结构（被操作的对象）；切角表示动机（为什么）。类元素显示成员分栏；事件、网关和分叉条表示控制。

**每种关系拥有完整的记号**，包括线型和两端的标记。实现关系无论在 ArchiMate 视图还是类图中，都是带空心三角的虚线。仓库测试会对示例用到的每一种关系检查这一点。

深色、浅色和蓝图三种主题使用与 Archify 原生成品相同的色彩变量，并随每个导出的 SVG 一起保存。

<span id="studio" class="section-anchor" aria-hidden="true"></span>

## 试用 Studio

Studio 是基于同一份模型的单文件页面。它直接在你的浏览器中运行：不会上传任何内容，你的修改只保存在当前浏览器的本地存储中。

<iframe class="studio-frame" src="enterprise-studio.html" title="Archify Enterprise Studio" loading="lazy"></iframe>

<p class="studio-open"><a href="enterprise-studio.html">在新标签页中打开 Studio →</a></p>

- **Views** 用于在十四个示例视图之间切换。
- **画布：** 拖动平移，滚轮缩放，点击选中节点或关系，把节点拖到另一个网格单元。
- **Inspect：** 重命名、更改类型、补充说明、连接或删除。修改会应用到该元素出现的所有视图。
- **Code** 和 **Tasks** 展示模型生成的内容。
- **Model** 就是类型化 JSON 本身，可直接编辑并应用。
- **Run tokens** 可在活动图、BPMN 和状态机视图中逐步推进令牌。

Studio 目前只有英文界面，提供复制按钮而不提供文件下载。需要写出文件时请使用命令行。

<span id="generate" class="section-anchor" aria-hidden="true"></span>

## 能生成什么

**代码。** 由类元素及其关系生成 TypeScript、Java 和 Python 类型；由实体生成 PostgreSQL DDL，并根据多重性推导键；由应用接口生成 OpenAPI；由状态视图生成状态机转换表；还可生成带图形交换信息的 BPMN 2.0 XML 和 ArchiMate 交换格式。

**任务。** 按 TOGAF ADM 阶段分组的交付计划。每个元素对应一项带验收标准的工作，先后顺序来自模型中已有的关系：使用方等待为它提供服务的一方；需求在实现它的元素构建完成后才验证；制品在其节点就绪后才部署。计划可导出为 Markdown、CSV、JSON 或 GOAL Agent 程序。

**Archify 原生图表。** 类图、时序图、状态机和架构类视图可以编译为 Archify 原生的类型化 JSON，从而使用现有的渲染器、Viewer 和交付检查。相关流程见 [Agent 画图指南](agent-diagrams.html)。

<span id="cli" class="section-anchor" aria-hidden="true"></span>

## 命令行用法

在已安装的 Skill 目录中运行：

```bash
node enterprise/bin/enterprise.mjs validate enterprise/examples/order-to-cash.enterprise.json
node enterprise/bin/enterprise.mjs build enterprise/examples/order-to-cash.enterprise.json --out enterprise-out
```

`build` 会为每个视图写出一个 SVG，并写出生成的代码、任务计划和原生类型化 JSON。`validate` 会给出带稳定代码的问题、涉及的元素和可行的修复方式；模型无效时不会写出任何文件。

如果想交给 Agent 来做，先[安装 Archify](start.html)，再用自然语言描述模型，例如：*“把我们的订购平台建模为一个 ArchiMate 分层视图和一个 BPMN 履约流程，然后生成任务计划。”*

<span id="limits" class="section-anchor" aria-hidden="true"></span>

## 如实说明的局限

- **布局需要编写。** 视图需要指定行和列，没有自动布局。
- **不支持导入。** 无法读取已有的 BPMN、XMI 或 ArchiMate 文件。
- **生成的是骨架，不是实现。** 生成的代码包含类型、字段和方法桩，不包含方法体。
- **导出格式只做了部分验证。** 生成的 BPMN 已在 bpmn.io 查看器中打开，没有警告。ArchiMate 交换文件只检查了 XML 格式是否良好，GOAL Agent 程序尚未在 GOAL 工具链中运行。这两项请在你自己的工具中验证。
- **交付检查。** BPMN、活动图和用例图没有对应的 Archify 原生图表类型，它们的 SVG 不经过 Archify 的交付检查；编译出的原生图表则会经过。
- **是模型，不是证明。** 与所有 Archify 图表一样，视图展示的是作者提供的事实，并不能证明运行中的系统确实如此。
