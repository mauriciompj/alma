# Google Login no ALMA

## Visão geral

O login via Google usa Google Identity Services no frontend e validação real do `id_token` no backend em `netlify/functions/auth.mjs`.

O Google prova a identidade. A sessão final continua sendo do ALMA.

## Variáveis de ambiente

Configure em `.env` ou nas variáveis do Netlify:

```env
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_HOSTED_DOMAIN=
```

`GOOGLE_HOSTED_DOMAIN` é opcional. Se definido, apenas contas desse domínio Workspace poderão entrar.

## Configuração no Google Cloud

Crie um OAuth Client do tipo `Web application`.

Em `Authorized JavaScript origins`, inclua pelo menos:

- `https://projeto-alma.netlify.app`
- `http://localhost:8888`

Para este fluxo com popup, não é necessário usar redirect URI no login da página.

## Como autorizar usuários

O Google login não cria usuários automaticamente.

Cada conta Google precisa estar vinculada a um usuário existente no `users_json` dentro de `alma_config`.

Campos aceitos para vínculo:

- `googleEmail`
- `email`
- `googleSub`
- `username` quando `username` for o próprio e-mail Google

Exemplo:

```json
[
  {
    "username": "noah",
    "password": "$2b$12$hashbcrypt...",
    "name": "Noah",
    "type": "filho",
    "googleEmail": "noah@exemplo.com"
  },
  {
    "username": "mauricio@exemplo.com",
    "password": "$2b$12$hashbcrypt...",
    "name": "Maurício",
    "type": "admin",
    "admin": true,
    "email": "mauricio@exemplo.com"
  }
]
```

Se quiser vínculo mais rígido e imutável, use `googleSub`.

## Fluxo implementado

1. `login.html` consulta `auth` com `action: "google_config"`.
2. Se `GOOGLE_CLIENT_ID` existir, o botão Google é exibido.
3. O frontend recebe um `credential` do Google.
4. O backend valida assinatura, `aud`, `iss`, `exp` e opcionalmente `hd`.
5. O backend procura o usuário ALMA correspondente.
6. Se autorizado, emite um token de sessão padrão do ALMA.

## Limitações atuais

- A sessão ainda é guardada no `localStorage`, como o restante do login atual.
- O painel admin ainda não tem UI própria para editar `googleEmail`, `email` ou `googleSub`.
- O fluxo depende de conectividade com endpoints públicos do Google para obter a configuração OpenID e as chaves JWKS.

## Próximo endurecimento recomendado

- Migrar a sessão do ALMA para cookie `HttpOnly`.
- Adicionar edição de identidade Google no painel admin.
- Criar testes automatizados mockando JWKS e `id_token`.
