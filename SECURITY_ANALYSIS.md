# Relatório de Segurança e Escalabilidade — Upeva

**Data:** 2026-03-20 | **Stack:** React 19 + Firebase + TypeScript + Vite | **Região:** southamerica-east1

---

## Nota Geral

| Categoria | Nota | Justificativa |
|-----------|------|---------------|
| **Segurança** | **8.0 / 10** | Firestore rules excelentes, Custom Claims, catch-all deny, Cloud Functions para operações sensíveis. Falta logging, validação de input mais rigorosa no backend e tratamento de race conditions. |
| **Escalabilidade** | **7.0 / 10** | Paginação server-side, aggregation queries, React Query com cache. Limitado por busca client-side, rate limit sem cleanup, maxInstances conservador. |
| **Nota Final** | **7.5 / 10** | App bem construído para o estágio atual. Precisa de ajustes pontuais para produção em escala. |

---

## O QUE ESTÁ BEM FEITO

1. **Firestore Rules robustas** — Catch-all deny, whitelist explícita, validação de enum nos status, Custom Claims eliminam reads no Firestore durante auth checks
2. **Storage Rules** — Limite de 10MB, validação de content-type `image/*`, acesso restrito por role
3. **Secrets em env vars** — Nenhum API key hardcoded, `.env` no `.gitignore`
4. **Cloud Functions para operações sensíveis** — `createApplication`, `createUser`, `updateUserRole` passam pelo backend
5. **Rate limiting em applications** — Hash de email + window de 24h + limite de 5
6. **Trigger deduplication** — `markEventProcessed` com `doc.create()` para idempotência em triggers
7. **Validação Zod no frontend** — Schemas completos com `react-hook-form` + `@hookform/resolvers`
8. **Zero XSS** — Nenhum `dangerouslySetInnerHTML`, `eval()`, ou renderização de HTML dinâmico
9. **Paginação server-side** — `PUBLIC_PAGE_SIZE = 12`, `ADMIN_PAGE_SIZE = 25` com cursor-based pagination
10. **Aggregation queries** — `count()` ao invés de full scans para metadata
11. **Índices composites** — 9 índices bem definidos para as queries de animals e applications

---

## PROBLEMAS ENCONTRADOS

### CRÍTICOS (Corrigir antes de escalar)

**C1. Logging ausente nas Cloud Functions**
- `functions/src/index.ts` — Nenhum `logger.error()` ou error tracking em nenhuma função
- Impossível debugar erros em produção. Se uma transação falha, não há rastro
- **Fix:** Importar `logger` de `firebase-functions/v2` e logar erros com contexto (uid, operação, dados relevantes)

**C2. Validação de input incompleta no backend**
- `functions/src/index.ts:189-296` — `createApplication` aceita campos opcionais sem validar tipos nem comprimentos
  - `comments`: sem limite de tamanho (DoS com string de 10MB)
  - `phone`: sem validação de formato
  - `childrenAges`: array sem validação de tipos internos
  - `birthDate`: sem validação de data válida
- **Fix:** Adicionar `zod` ao backend e validar schema completo antes de persistir

**C3. Error handling genérico em `markEventProcessed`**
- `functions/src/index.ts:36-44` — `catch {}` captura TODOS os erros, não apenas "document already exists"
- Se ocorrer "permission denied" ou "connection lost", o evento é silenciosamente ignorado para sempre
- **Fix:** Checar `error.code === 'already-exists'` e re-throw demais erros

---

### ALTOS (Importantes para produção)

**A1. Race condition em `onUserCreated`**
- `functions/src/index.ts:71-72` — Se dois usuários se registram simultaneamente e não há admin, ambos podem receber role `admin`
- Query `where("role", "==", "admin").limit(1)` dentro de transação não garante serialização completa

**A2. Índice faltando para query de applications por animalId + status**
- `functions/src/index.ts:440-444` — Query `.where("animalId", "==", ...).where("status", "in", [...])` requer índice composite
- `firestore.indexes.json` — Não possui este índice
- **Fix:** Adicionar índice `{animalId: ASC, status: ASC}` ao firestore.indexes.json

**A3. Inconsistência entre Custom Claims e Firestore**
- `functions/src/index.ts:129-139` — `createUser` seta Custom Claims ANTES de escrever no Firestore
- Se o write no Firestore falha, o usuário tem claims mas nenhum documento de perfil
- **Fix:** Inverter a ordem — escrever no Firestore primeiro, depois setar claims

**A4. Rate limit sem cleanup — crescimento indefinido**
- `functions/src/index.ts:215-247` — Documentos em `rateLimits` nunca são deletados
- Com o tempo, a collection cresce indefinidamente, aumentando custos de storage
- **Fix:** Configurar Firestore TTL policy ou criar Cloud Scheduler para cleanup periódico

**A5. `updateUserRole` não verifica se o UID existe no Firebase Auth**
- `functions/src/index.ts:175` — `setCustomUserClaims(uid, {role})` em UID inválido pode falhar de forma inesperada
- **Fix:** Chamar `adminAuth.getUser(uid)` antes e tratar erro `not-found`

---

### MÉDIOS (Melhorias recomendadas)

**M1. PII em sessionStorage sem criptografia**
- Formulário de adoção salva rascunho com nome, email, telefone, endereço em `sessionStorage` como texto plano
- Risco em dispositivos compartilhados (embora `sessionStorage` limpe ao fechar aba)

**M2. Busca de animais é client-side**
- Filtro por nome percorre todos os animais carregados em memória. Com 1000+ animais, isso se torna lento
- **Fix futuro:** Implementar busca server-side (Firestore não suporta full-text nativo — considerar Algolia, Typesense, ou Cloud Function com prefix matching)

**M3. `maxInstances: 10` em `createApplication` pode ser baixo**
- Em pico de tráfego (campanha de adoção, posts virais), 10 instâncias simultâneas podem não ser suficientes
- **Fix:** Aumentar para 20-50 dependendo do tráfego esperado

**M4. Timeout hardcoded de 2000ms para sync de metadata**
- `setTimeout` de 2s para invalidar cache após mutation é frágil — rede lenta pode não ter completado
- **Fix:** Usar `onSnapshot` listener ou invalidar cache com callback do Cloud Function

**M5. Regex de email fraca no backend**
- `functions/src/index.ts:29-31` — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` aceita emails como `a@b.c`
- **Fix:** Usar validação Zod `.email()` que segue padrão mais rigoroso

**M6. Falta debounce na busca de animais**
- Filtragem dispara a cada keystroke sem throttling — gera re-renders desnecessários

**M7. Upload de fotos sem limite de concorrência**
- `Promise.all()` para múltiplas fotos pode sobrecarregar a rede do usuário
- **Fix:** Usar `Promise.allSettled()` com chunks de 3 uploads simultâneos

---

### BAIXOS (Nice to have)

**B1. Falta Content Security Policy (CSP) headers** no Firebase Hosting — protegeria contra XSS mesmo se uma vulnerabilidade for introduzida no futuro

**B2. Sem error monitoring** (Sentry, Firebase Crashlytics) — erros do frontend somem silenciosamente

**B3. `getAnimalById()` retorna animais em qualquer status** — permite que URLs diretas acessem animais `under_review` ou `archived` (dados são públicos nas rules, mas UX poderia filtrar)

**B4. Sem testes de segurança** — `firebase-functions-test` não está configurado para testar regras e funções

---

## PLANO DE AÇÃO PRIORIZADO

| Prioridade | Item | Esforço | Impacto |
|-----------|------|---------|---------|
| 1 | Adicionar logging estruturado nas Cloud Functions (C1) | Baixo | Alto |
| 2 | Adicionar Zod validation no backend (C2, M5) | Médio | Alto |
| 3 | Corrigir error handling em `markEventProcessed` (C3) | Baixo | Alto |
| 4 | Adicionar índice faltando para applications (A2) | Baixo | Alto |
| 5 | Inverter ordem Claims/Firestore em createUser (A3) | Baixo | Médio |
| 6 | Verificar existência do UID em updateUserRole (A5) | Baixo | Médio |
| 7 | Configurar TTL ou cleanup para rateLimits (A4) | Médio | Médio |
| 8 | Adicionar CSP headers no firebase.json (B1) | Baixo | Médio |
| 9 | Aumentar maxInstances do createApplication (M3) | Baixo | Médio |
| 10 | Implementar debounce na busca (M6) | Baixo | Baixo |
| 11 | Adicionar error monitoring — Sentry (B2) | Médio | Médio |
| 12 | Migrar busca para server-side (M2) | Alto | Alto (futuro) |

---

## CONCLUSÃO

O app está **acima da média** para o estágio em que se encontra. As Firestore Rules são particularmente bem escritas — o uso de Custom Claims, catch-all deny, e Cloud Functions para operações sensíveis demonstra maturidade na arquitetura de segurança.

Os pontos críticos são operacionais (logging, validação backend) e não estruturais. A fundação é sólida — os ajustes necessários são incrementais e não requerem refatoração significativa.

Para escalar para milhares de animais/aplicações, os itens M2 (busca server-side) e A4 (cleanup de rate limits) se tornam prioritários. Para o volume atual, a arquitetura suporta bem.

---

## ESTRATÉGIA DE CICLO DE VIDA E ARCHIVING

### O que arquivar e quando

| Dados | Quando arquivar | Destino | Observação |
|-------|-----------------|---------|------------|
| Applications **aprovadas** (adoção concluída) | 30 dias após status `approved` | Google Sheets | Exportar com dados do animal + adotante |
| Applications **rejeitadas** | 30 dias após status `rejected` | Google Sheets | Manter histórico para consulta |
| Applications **canceladas/expiradas** | 30 dias após status `cancelled` | Google Sheets | — |
| Animais **adopted** | 30 dias após adoção concluída | Google Sheets | Dados do animal + adotante vinculado |
| Animais **archived** | 30-60 dias após arquivamento | Google Sheets | Transferidos, falecidos, etc. |
| Documentos de **rateLimits** | Imediato após expirar janela de 24h | **Deletar** (sem exportar) | Dados efêmeros, sem valor histórico |
| **processedEvents** | 7 dias após criação | **Deletar** (sem exportar) | Dados de deduplicação, efêmeros |
| Fotos de animais adotados/archived | 60-90 dias após adoção/archive | Deletar do Storage | Exportar 1 thumbnail para a planilha antes |

### Arquitetura de implementação

1. **Cloud Scheduler** (cron) roda diariamente
2. Chama Cloud Function `archiveOldRecords`
3. A função:
   - Query applications/animals com `updatedAt < 30 dias atrás` e status final
   - Exporta para Google Sheets via Google Sheets API
   - Deleta do Firestore em batch (max 500 por batch)
   - Loga quantidade e IDs arquivados
4. **Apps Script** na planilha com funções de consulta (ex: `consultarAdoção(email)`)

### Google Sheets — boas práticas

**Prós:** Gratuito, acessível para a ONG sem ferramentas técnicas, Apps Script permite consultas e automações.

**Limitações a considerar:**
- Limite de **10 milhões de células** por planilha
- Performance degrada a partir de ~50k linhas
- Não é banco de dados — queries complexas são lentas

**Recomendação:** Usar **uma planilha por ano** (ex: `Adoções 2026`, `Rejeitados 2026`) para evitar crescimento indefinido e facilitar organização.

### Apps Script para consulta de arquivados

É possível criar funções no Google Apps Script para ler dados arquivados de volta, como:
- `consultarAdoção(email)` — busca histórico de um adotante
- `relatórioMensal(mês, ano)` — gera resumo de adoções/rejeições
- Endpoint REST via Apps Script Web App que a Cloud Function pode consumir se necessário

### Alternativa futura (se o volume crescer)

Se o volume ultrapassar o confortável para Sheets (~50k registros/ano), considerar **BigQuery** — Firebase tem integração nativa, custo quase zero para volumes pequenos, e oferece SQL completo para consultas. Para o estágio atual, Google Sheets é pragmático e suficiente.
