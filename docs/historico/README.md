# Histórico — a versão anterior do Mais Horas

Os três documentos desta pasta descrevem o **primeiro sistema**, em Node/Express, que foi
substituído pelo backend em FastAPI. Eles não valem como especificação de nada que roda
hoje; ficam aqui porque contam de onde o projeto partiu e por que ele foi redesenhado.

| Documento | O que é |
|---|---|
| [requisitos.md](requisitos.md) | Requisitos levantados **a partir do código antigo**, com os casos de uso e as 10 lacunas encontradas — inclusive as duas reproduzidas em ambiente. A última seção mostra o que aconteceu com cada uma |
| [api.md](api.md) | Referência dos endpoints daquele backend |
| [backend-refactor.md](backend-refactor.md) | As correções feitas no backend antigo, item a item, e o raciocínio por trás de cada uma. As decisões foram preservadas na migração |

**Onde está a documentação que vale hoje:**

| Assunto | Documento |
|---|---|
| O que o sistema faz, tela por tela | [../especificacao.md](../especificacao.md) |
| Caminhos de uso e exceções | [../fluxos.md](../fluxos.md) |
| Endpoints, payloads e erros | [../contrato-api.md](../contrato-api.md) |
| Tabelas e restrições | [../modelo-dados.md](../modelo-dados.md) |
| Sessão e login | [../autenticacao.md](../autenticacao.md) |
| Pastas, componentes e rotas de tela | [../arquitetura.md](../arquitetura.md) |
| O que já foi construído | [../plano-execucao.md](../plano-execucao.md) |
