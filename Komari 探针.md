
在容器平台里插上 Komari 探针
在NodeJS、Python环境的容器平台运行Komari Agent
这里我们用komari-agent-webhost这个项目，这也是Komari官方提到的社区维护的Agent项目之一，这个项目介绍也是”使用解释型语言写的komari探针，适用于限制执行二进制探针的虚拟主机环境“
使用子进程运行，最小改动源代码，不影响原项目运行
NodeJS 环境
nodejs环境呢分两种情况
一种你原本运行的 nodejs 项目是传统的 CommonJS 项目
还有一种就是 ESM 项目
可以通过以下 3 种方法 快速判断：
看 （最标准）：package.json打开项目根目录的 ，检查是否有 ：package.json``"type": "module"
有"type": "module" \rightarrow当前项目是 ESM
没有，或者为"type": "commonjs" \rightarrow当前项目是 CommonJS （CJS）
看文件代码中的语法：
ESM： 使用 或import ... from ...``export default ...
CommonJS： 使用 或const ... = require(...)``module.exports = ...
看入口文件后缀：
.mjs \rightarrow强制为 ESM
.cjs \rightarrow强制为 CommonJS
.js \rightarrow取决于 中的 配置package.json``type
传统 CommonJS
我们用老王的 node-ws 为例，上传index.js启动文件和package.json依赖文件，再把komari-agent-webhost项目index.js重命名为kma.cjs上传到与node-ws项目的index.js同目录
修改package.json文件，加上komari-agent-webhost所需的依赖"ws": "^8.14.2"和"@homebridge/node-pty-prebuilt-multiarch": "^0.13.1"，node-ws有ws就只加node-pty
​
修改原项目的index.js启动文件，拉到最底下添加三行命令，在启动项目时启动kma.js
​
ESM 项目
ESM项目和CommonJS一样，只在启动时命令不一样
​
Python 环境
python我用的少，依旧用老王的 python-ws 项目为例
老王 python-ws 的 improt 已经导入sys和subprocess，不用管
依旧上传app.py启动文件、requirements.txt依赖文件以及komari-agent-webhost的agent.py，建议改名
合并requirements.txt
​
app.py要改两个地方
在def cleanup_files():的正上方加
源代码624行
​
在 async def main(): 的内部加
源代码646行
​
我的 Komari https://tz.nyx.us.ci
不加载什么的有问题就刷新，edgeone的cdn太拉了，还没换回cf
AI时代，小白改代码很轻松，这呢提供这么一种思路，少动源码少Bug。有好思路大家多分享
容器平台运行记得混淆！！！
