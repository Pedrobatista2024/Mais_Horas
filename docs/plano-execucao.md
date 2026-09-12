# Plano de Execução — Mais Horas

Como sair do código atual e chegar ao sistema definido em
[especificacao.md](especificacao.md), sem ficar semanas com nada funcionando.

---

## 1. Decisões de execução

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| **D38** | Estratégia | **Fatia vertical** — uma funcionalidade completa por vez, do banco à tela | O sistema roda o tempo todo; dá para demonstrar em qualquer momento |
| **D39** | E-mail | **Console em dev**, provedor real só no deploy | Destrava a recuperação de senha (D15) sem depender de serviço externo agora |
| **D40** | Testes | **pytest junto com cada fatia** | Resolve a dívida de cobertura em vez de arrastá-la; `smoke_test.py` é aposentado ao final |

---

## 2. O problema que o plano resolve

O código de hoje funciona — 68 verificações passando. Mas o alvo muda o contrato inteiro:

| | Hoje | Alvo |
|---|---|---|
| Rotas | `/api/activities` | `/api/v1/atividades` |
| Identificador | `_id` | `id` |
| Erro | `{ message, details }` | `{ codigo, mensagem, detalhes }` |
| Tabelas | inglês | português |

**Backend e frontend quebram juntos.** Por isso a ordem importa: cada fatia leva uma
funcionalidade de ponta a ponta, deixando o sistema sempre utilizável — com menos recursos,
nunca quebrado.

---

## 3. As fatias

### Fatia 0 — Fundação

Única que não é vertical: não tem tela, mas nada existe sem ela.

- As 8 migrations do [modelo-dados.md](modelo-dados.md), com as tabelas em português
- Modelos SQLAlchemy e esquemas Pydantic
- `core/config`, `core/security` (Argon2id, Ed25519, JWT), `core/errors` no formato novo
- `pytest` configurado, com banco de teste isolado
- Geração e carga da chave de assinatura

**Pronto quando:** `alembic upgrade head` cria as 10 tabelas e o pytest roda vazio sem erro.

---

### Fatia 1 — Acesso

**Backend:** `/auth/cadastro` · `/entrar` · `/renovar` · `/sair` · `/senha/esqueci` · `/senha/redefinir`
**Frontend:** `T7` Entrar · `T8` Criar conta · `AuthContext` no contrato novo
**Fluxos:** FA-01 a FA-05 · **Regras:** RN-17, RN-22, RN-38, RN-42

**Pronto quando:** dá para criar conta, entrar, recarregar a página sem perder a sessão e
recuperar a senha pelo link que aparece no terminal.

---

### Fatia 2 — Perfil

**Backend:** `/perfil` (ler, atualizar, foto) · `/usuarios/{id}/publico`
**Frontend:** `E7` Meu perfil · `O8` Perfil da ONG
**Fluxos:** FE-09 · **Regras:** RN-13 (perfil mínimo)

**Pronto quando:** o aluno preenche o perfil e o sistema sabe dizer se está completo.

---

### Fatia 3 — Atividades

**Backend:** CRUD, rascunho, publicar, cancelar, vitrine paginada e filtrada no servidor
**Frontend:** `E2` Vitrine · `E3` Detalhe · `O2` Minhas atividades · `O3` Criar/editar · `O4` Gerenciar
**Fluxos:** FE-01, FO-01 a FO-04, FO-10 · **Regras:** RN-05 a RN-11, RN-20, RN-47 a RN-49

**Pronto quando:** a ONG publica uma atividade e o aluno a encontra na vitrine.

---

### Fatia 4 — Inscrições

**Backend:** inscrever, cancelar, aprovar, recusar, listar
**Frontend:** `E4` Minhas inscrições · `O5` Inscrições
**Fluxos:** FE-02 a FE-04, FE-06, FO-05, FO-06 · **Regras:** RN-01, RN-12, RN-14, RN-19

**Pronto quando:** o aluno se inscreve, a ONG aprova, e o limite de 5 inscrições barra
quem passar do teto.

---

### Fatia 5 — Presença e check-in ⭐

O diferencial técnico do projeto.

**Backend:** token derivado do tempo, `/checkin`, registro manual, validação de presença
**Frontend:** `E5` Check-in · `O6` Painel de QR rotativo · `O7` Validar presenças
**Fluxos:** FE-05, FO-07 a FO-09 · **Regras:** RN-03, RN-04, RN-15 a RN-17, RN-43

**Pronto quando:** o QR rotaciona a cada 30 s, o aluno registra presença lendo a tela, e um
código de 40 segundos atrás é recusado.

---

### Fatia 6 — Certificado ⭐

**Backend:** emissão assinada em Ed25519, PDF com QR, verificação pública, revogação
**Frontend:** `E6` Meus certificados · `T6` Verificação pública
**Fluxos:** FE-07, FE-08, FV-01, FV-02 · **Regras:** RN-02, RN-18, RN-19, RN-24, RN-56

**Pronto quando:** o ciclo fecha — atividade finalizada emite certificado assinado, e a
página pública mostra os três selos. **É aqui que o sistema vira demonstrável de ponta a
ponta.**

---

### Fatia 7 — Notificações

**Backend:** `/notificacoes` · **Frontend:** sino no cabeçalho
**Fluxos:** FE-10 · **Regras:** D16

---

### Fatia 8 — Console administrativo

**Backend:** `/admin/*`, trilha de auditoria alimentada por todas as fatias anteriores
**Frontend:** `A1` a `A8`
**Fluxos:** FS-01 a FS-11 · **Regras:** RN-23 a RN-26, RN-32 a RN-34, RN-40, RN-44

> A auditoria é escrita desde a Fatia 1 — o console só a lê. Adiar a escrita significaria
> voltar em todas as fatias depois.

---

### Fatia 9 — Portal institucional

**Frontend:** `T1` a `T5` — início, como funciona, para estudantes, para ONGs, parceiras

Fica por último de propósito: é a camada mais visível, mas a que menos bloqueia as outras.

---

## 4. Ordem e o ponto de virada

```
0 Fundação
 └─ 1 Acesso
     └─ 2 Perfil
         └─ 3 Atividades
             └─ 4 Inscrições
                 └─ 5 Check-in ⭐
                     └─ 6 Certificado ⭐  ← sistema demonstrável de ponta a ponta
                         ├─ 7 Notificações
                         ├─ 8 Console admin
                         └─ 9 Portal
```

**Da fatia 0 à 6 é o caminho crítico.** Concluídas essas sete, o projeto conta a história
inteira: ONG publica, aluno se inscreve, check-in por QR rotativo, certificado assinado e
verificação pública.

As fatias 7, 8 e 9 completam o produto, mas nenhuma é necessária para demonstrar a tese.
Se o prazo apertar, é por elas que se corta.

---

## 5. Definição de pronto

Uma fatia só está concluída quando:

1. Os endpoints respondem conforme [contrato-api.md](contrato-api.md)
2. As telas correspondentes funcionam, com estado vazio e erro tratados
3. Os fluxos da fatia foram percorridos, incluindo as exceções
4. Existem testes em pytest para as regras que **o banco não garante**
5. `npm run build` e `npm run lint` passam limpos
6. As ações da fatia aparecem na trilha de auditoria

---

## 6. O que acontece com o código atual

O backend de hoje é **substituído**, não adaptado. A cada fatia, o que ela cobre sai do
código antigo.

- `smoke_test.py` continua rodando enquanto houver código antigo, e é **removido ao final
  da Fatia 6**, quando o pytest já cobrir o mesmo terreno
- O banco atual já foi zerado; as migrations novas nascem em base limpa
- `docs/requisitos.md`, `arquitetura.md` e `api.md` descrevem o sistema antigo e vão
  perdendo validade fatia a fatia. Ao concluir a Fatia 6, cabe reescrevê-los ou removê-los

---

## 7. Sobre o e-mail (D39)

Em desenvolvimento, o link de redefinição é **escrito no terminal**, não enviado:

```
[email] Para: maria@email.com
[email] Redefinir senha: http://localhost:5173/redefinir-senha?token=...
```

O envio real fica atrás de uma interface só, trocada por variável de ambiente. A escolha do
provedor (Resend, Brevo ou SendGrid) acontece no deploy, sem tocar na regra de negócio.
