## shadcn

直接运行 `pnpm dlx shadcn-svelte@latest add` 可能会遇到网络问题，可以使用下面的命令绕过代理安装 shadcn 组件。

```
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy pnpm dlx shadcn-svelte@latest add card
```
