# 🐾 UPEVA — Como vamos fechar a plataforma

Material de apoio para a reunião com a ONG UPEVA.

Data de referência deste material: **13/04/2026**

---

## 💚 O que já entregamos

Hoje a plataforma já cobre a parte principal da operação da ONG:

- divulgação pública dos animais
- formulário de adoção em múltiplas etapas
- painel interno para a equipe
- gestão de animais
- triagem de candidaturas
- fila de espera por animal
- autenticação e controle de acesso da equipe

### Em outras palavras

✅ Na prática, o sistema já resolve o dia a dia para:

- cadastrar animais
- receber pedidos de adoção
- analisar candidatos
- aprovar ou rejeitar candidaturas
- acompanhar o status de cada animal

---

## 🚧 O que vamos implementar agora

O próximo passo não é refazer a base.
O próximo passo é fechar bem o **ciclo de vida dos dados**, para o sistema continuar leve, organizado e barato conforme a operação cresce.

### 1. Vamos implementar um cron de limpeza e arquivamento

Vamos criar uma rotina automática para:

- exportar dados históricos
- confirmar que a exportação foi concluída
- limpar do Firestore o que não precisa mais ficar “quente” no banco principal

### 2. Vamos separar dado operacional de dado histórico

A lógica será esta:

- manter no Firestore apenas o que é operacional
- levar histórico antigo para uma estrutura mais barata e simples de consultar

Hoje isso **ainda não está implementado**.
Então esta fase vai incluir a integração com **Google Sheets** e **Google Drive**.

### 3. Vamos organizar contratos do jeito certo

Aqui existe um ajuste importante:

**contrato não deve ficar “dentro da planilha” como arquivo.**

E aqui entra um ponto importante:
**o sistema atual ainda não possui um módulo real de contratos armazenados**.

Ou seja:

- o fluxo de adoção existe
- os termos existem no formulário
- mas o armazenamento/indexação de contrato ainda precisa ser criado

O desenho que vamos seguir é:

- **Google Drive** para guardar o PDF final
- **Google Sheets** para guardar o índice e os dados resumidos
- cada linha da planilha aponta para o PDF correspondente no Drive

### Como vamos fazer

1. Quando uma adoção for concluída, vamos gerar um **PDF de arquivo** com os dados consolidados.
2. Esse PDF pode reunir:
   - dados principais do adotante
   - snapshot do animal no momento da adoção
   - status final da candidatura
   - notas relevantes da análise
   - referência do contrato
3. Esse PDF será enviado para uma pasta organizada no **Google Drive**.
4. A planilha vai guardar:
   - identificador do registro
   - nome do adotante
   - nome do animal
   - data
   - status
   - link do PDF no Drive

Isso é melhor porque:

- deixa o histórico humano e fácil de consultar
- mantém o banco principal leve
- evita usar a planilha como depósito de arquivo
- facilita auditoria e consulta futura

### Sobre custo

Sim, isso pode ser usado de forma **gratuita**, desde que fique dentro da cota de armazenamento da conta Google usada.

Pelo material oficial do Google:

- toda conta Google padrão tem **15 GB gratuitos**
- esse espaço é compartilhado entre **Drive, Gmail e Google Photos**
- arquivos como **PDFs** contam para esse armazenamento

Então o modelo é gratuito **até atingir a cota da conta**.
Se a ONG usar uma conta Google comum e o volume ainda for baixo, isso é totalmente viável.
Se no futuro o volume crescer, aí podemos migrar para uma conta com mais armazenamento ou para Google Workspace.

Além disso, se usarmos **Apps Script** para apoiar a geração do PDF e a escrita em planilha, também continuamos em um caminho de baixo custo, com a ressalva de que o Apps Script possui **quotas diárias oficiais** de execução e serviços.

### 4. Vamos estruturar melhor as rejeições

Hoje o sistema já tem `adminNotes`, mas para histórico isso ainda está muito solto.

Antes de arquivar rejeições, vamos adicionar campos estruturados como:

- `reviewedAt`
- `reviewedBy`
- `rejectionReasonCode`
- `rejectionReasonSummary`

Isso melhora:

- rastreabilidade
- consistência dos relatórios
- consulta futura quando a mesma pessoa aparecer novamente

### 5. Vamos estruturar motivo de arquivamento dos animais

Hoje existe o status `archived`, mas não existe no modelo atual um motivo estruturado para isso.

Vamos adicionar algo como:

- `archiveReason`
- `archiveNotes`

Exemplos de motivo:

- adotado externamente
- transferido
- faleceu
- duplicado
- bloqueio veterinário
- outro

Sem isso, o histórico perde valor.

### 6. Vamos adicionar histórico de auditoria

Hoje o sistema guarda o estado atual muito bem, mas ainda não guarda um histórico completo de ações.

Vamos registrar:

- quem alterou o status
- quando alterou
- de qual status para qual status
- observação da ação

Isso é importante para:

- segurança
- governança
- transparência
- proteção da ONG em decisões sensíveis

---

## 📦 Como vamos organizar os dados históricos

### Planilha 1 — `Adoções Concluídas 2026`

Nessa planilha vamos guardar:

- candidatura aprovada finalizada
- snapshot do animal no momento da adoção
- dados principais do adotante
- link do PDF final no Google Drive
- data da aprovação
- data da exportação

### Planilha 2 — `Triagem Rejeitada 2026`

Nessa planilha vamos guardar:

- candidaturas rejeitadas após o prazo de retenção operacional
- nome da pessoa
- identificador seguro para conferência futura
- motivo estruturado da rejeição
- resumo da análise
- notas internas
- animal relacionado, se houver
- data da rejeição

### Planilha 3 — `Animais Arquivados 2026`

Também vamos criar essa planilha.

Nessa planilha vamos guardar:

- animais com status `archived`
- motivo do arquivamento
- dados básicos do animal
- data do arquivamento
- observações relevantes

Isso evita perder contexto quando um animal sai do fluxo normal sem ter sido adotado pela plataforma.

---

## 🧠 O que vamos levar para planilha e o que não vamos

### ✅ Vamos levar

- adoções concluídas
- contrato em PDF via link do Drive
- rejeições antigas
- animais arquivados
- um identificador seguro da pessoa para conferência futura
- snapshots históricos do animal e da candidatura

### ⚠️ Vamos levar com cuidado

- nome completo
- telefone
- e-mail
- CPF
- endereço

Esses dados são sensíveis.
Se forem para a planilha, o ideal é separar o que é:

- dado legal/operacional
- dado apenas de consulta futura

Para rejeitados, nós **não vamos confiar só em nome + nota**.
Nome sozinho é fraco e gera falso positivo.

Vamos guardar também:

- CPF mascarado
- e-mail normalizado
- telefone normalizado
- hash interno de identidade

Assim a ONG consegue conferir recorrência sem depender apenas do texto livre.

### ❌ Não vamos levar

- `users`
- `metadata`
- `rateLimits`
- `_processedEvents`
- fila operacional ativa
- fotos brutas dentro da planilha

Esses dados são internos, temporários ou técnicos.
Não agregam valor histórico em Sheets.

---

## 🔄 Como vamos implementar o arquivamento

### Fluxo

1. O registro fica no Firestore enquanto ainda é operacional.
2. Depois de um prazo definido, um cron roda automaticamente.
3. O cron exporta os dados para a planilha correta.
4. Se existir adoção concluída, o sistema gera o PDF consolidado e envia para o Drive.
5. A planilha recebe o link do PDF e os dados resumidos.
6. O sistema registra que a exportação ocorreu.
7. Só depois disso o Firestore remove o dado operacional antigo.

### Como vamos implementar tecnicamente

#### Fase 1 — versão mais simples e barata

Vamos seguir este desenho:

1. **Cloud Scheduler** dispara 1 job diário.
2. Esse job chama uma **Cloud Function** dedicada de arquivamento.
3. A function busca:
   - adoções concluídas fora da janela operacional
   - rejeições antigas
   - animais arquivados
4. A function monta um **snapshot histórico** dos dados.
5. Para adoções concluídas, vamos gerar um **PDF consolidado**.
6. Esse PDF será salvo em uma pasta organizada no **Google Drive**.
7. Depois disso, a function escreve uma linha na **Google Sheets** correspondente.
8. Por fim, o Firestore marca o registro como exportado e remove o que não precisa continuar no banco operacional.

#### Organização que vamos usar no Drive

- `UPEVA / Historico / 2026 / Adocoes`
- `UPEVA / Historico / 2026 / Rejeicoes`
- `UPEVA / Historico / 2026 / Animais-Arquivados`

#### Nome sugerido dos PDFs

- `2026-04-13_adocao_nina_maria-silva.pdf`
- `2026-04-13_rejeicao_luke_joao-souza.pdf`

Isso facilita:

- consulta manual
- auditoria
- compartilhamento interno
- organização por ano

#### Melhor forma de gerar o PDF

Temos duas opções viáveis:

1. **Gerar HTML/PDF dentro da Cloud Function**
2. **Usar Google Docs/Apps Script para montar o documento e exportar em PDF**

Para a UPEVA, eu recomendo começar pela segunda abordagem, porque:

- é mais simples de manter
- integra naturalmente com Drive e Sheets
- facilita ajustes visuais no template do documento
- continua barata para o volume esperado

Se o volume crescer bastante no futuro, aí migramos a geração para dentro da própria backend layer.

### Prazo inicial sugerido

- aprovados/adotados: **30 a 60 dias**
- rejeitados: **30 a 60 dias**
- `rateLimits`: **logo após expirar a janela**
- `_processedEvents`: **7 dias**

---

## 💸 Como fica o custo disso tudo

### Infra atual identificada no projeto

- **Firestore:** `southamerica-east1` (São Paulo / Brasil)
- **Cloud Functions:** `southamerica-east1` (São Paulo / Brasil)
- **Storage do projeto:** `us-east1`
- **Hosting:** Firebase Hosting

### Ponto importante da arquitetura atual

O suspeito principal estava correto só em parte:

- **Firestore e Functions** podem ficar no Brasil e continuam com cotas grátis
- **Storage** é o componente em que a região influencia diretamente a cota grátis do bucket `*.firebasestorage.app`

No projeto atual isso ficou favorável:

- o bucket atual está em **`us-east1`**
- essa é uma das regiões que **mantêm a cota grátis do Firebase Storage**

---

## 📊 Quando começaria a pesar no bolso

Para a reunião, a leitura simples é esta:

### Hoje, o cenário mais provável é:

**custo muito baixo ou até zero**, enquanto o volume continuar pequeno/médio.

### O que mais provavelmente vai gerar custo primeiro

1. **transferência de imagens** do Storage
2. **transferência do Hosting**
3. **leituras do Firestore**

### O que dificilmente vai pesar no começo

- Cloud Scheduler
- operações de upload/download do Storage
- invocações de Functions por quantidade pura

---

## 🧮 Cenários mistos de uso

Esta parte é uma **estimativa prática**, feita com base no comportamento atual do sistema.

### Premissas usadas

Para tornar isso mais palpável, considerei um uso médio assim:

- usei **sessões públicas**, e não **pessoas únicas**
- isso é mais confiável para estimar custo, porque a mesma pessoa pode acessar várias vezes no mês

- **1 sessão pública** = home + lista de animais + 1 detalhe
- essa sessão consome aproximadamente:
  - **~1 MB** de tráfego de Hosting
  - **~3 MB** de imagens vindas do Storage
  - **~75 leituras** de Firestore
- **1 formulário enviado** consome aproximadamente:
  - **1 chamada** de Cloud Function
  - **~5 leituras** de Firestore
  - **~3 escritas** de Firestore
- **1 animal cadastrado** com 5 fotos comprimidas:
  - **~5 MB** novos no Storage
- **1 exportação histórica**:
  - **~1 linha** em planilha
  - **~1 PDF** no Drive com cerca de **0,5 MB**

Esses números são aproximados e servem para leitura de negócio.

### Cenário A — operação tranquila

- **5.000 sessões públicas/mês**
- **150 formulários enviados**
- **50 animais cadastrados**
- **120 registros exportados**

Resultado esperado:

- custo ainda muito próximo de **R$ 0**
- toda a operação continua confortável dentro das cotas grátis

### Cenário B — operação já movimentada

- **15.000 sessões públicas/mês**
- **400 formulários enviados**
- **120 animais cadastrados**
- **300 registros exportados**

Resultado esperado:

- custo estimado em torno de **R$ 2,90/mês**
- começa a aparecer cobrança, principalmente por **Hosting**

### Cenário C — ponto em que começa a passar de R$ 10

- **25.000 sessões públicas/mês**
- **700 formulários enviados**
- **200 animais cadastrados**
- **500 registros exportados**

Resultado esperado:

- custo estimado em torno de **R$ 10,80/mês**
- o principal fator continua sendo **tráfego do Hosting**
- Firestore ainda não é o maior problema nesse nível
- exportação histórica ainda pesa muito pouco na fatura

### Cenário D — operação forte, mas ainda barata para o porte

- **30.000 sessões públicas/mês**
- **1.000 formulários enviados**
- **300 animais cadastrados**
- **800 registros exportados**

Resultado esperado:

- custo estimado em torno de **R$ 15/mês**
- ainda é uma operação com custo baixo para uma plataforma completa

### Leitura prática desses cenários

Pelo desenho atual, para a plataforma passar de **R$ 10/mês**, o mais provável é acontecer algo perto de:

- **~25 mil sessões públicas por mês**
- junto com algumas centenas de formulários
- e ainda assim com custo concentrado mais em **tráfego** do que em banco

Ou seja:

- **animais cadastrados** quase não pesam no custo no começo
- **dados exportados** quase não pesam no Firebase
- o que mais pesa primeiro é **gente acessando a plataforma e consumindo mídia**

### Leitura específica por volume de animais

Se considerarmos uma média de **5 MB por animal** em fotos:

- com **~1.024 animais** armazenados ainda estaríamos só chegando perto dos **5 GB grátis** do Storage
- para o armazenamento isoladamente começar a gerar algo próximo de **R$ 10/mês**, estaríamos falando de algo na faixa de **~21 mil animais** nesse mesmo tamanho médio

Então o custo por quantidade de animais, sozinho, **não é o gargalo inicial**.

### Leitura específica para PDFs históricos

Se cada PDF histórico tiver em média **0,5 MB**, uma conta Google com **15 GB** consegue armazenar algo perto de:

- **~30 mil PDFs**

Na prática, isso mostra que o arquivo histórico em Drive é bastante viável para o estágio atual da UPEVA.

---

## 🧮 Referência prática: quando um item sozinho passa de ~R$ 10/mês

Conversão usada para esta conta:

- **US$ 1 = R$ 5,0229**
- referência: **PTAX fechamento de 10/04/2026**
- então **R$ 10 ≈ US$ 1,99**

### Firestore

- cerca de **6,6 milhões de leituras pagas** no mês
- ou cerca de **2,2 milhões de escritas pagas** no mês
- ou cerca de **19,9 milhões de deleções pagas** no mês
- ou cerca de **13,3 GiB pagos de armazenamento** além da cota grátis

Leitura simples:
o Firestore só começa a incomodar de verdade com **muito acesso** ou com **bastante histórico acumulado**.

### Cloud Functions

- cerca de **5 milhões de chamadas pagas** no mês
- ou cerca de **16,6 GB pagos de saída de rede**

Como ainda existe franquia grátis antes disso, na prática seria algo próximo de:

- **~7 milhões de chamadas totais/mês**
- ou **~21,6 GB totais de saída**

### Firebase Storage

Como o bucket atual está em `us-east1`, ele mantém a cota grátis do Firebase Storage.

Para passar de ~R$ 10 só com esse item:

- cerca de **99,5 GiB pagos de armazenamento**
- ou cerca de **16,6 GB pagos de download para internet**

Na prática, considerando a franquia grátis atual do Firebase Storage:

- **~105 GiB totais armazenados**
- ou **~116,6 GB totais de download/mês**

### Firebase Hosting

Para passar de ~R$ 10 só com Hosting:

- cerca de **13,3 GB pagos de transferência**
- ou cerca de **76,6 GB pagos de armazenamento**

Como o Hosting já tem cota grátis diária de transferência, isso vira algo próximo de:

- **~24 GB totais/mês de tráfego**

### Cloud Scheduler

O custo é muito baixo.

- existem **3 jobs grátis por billing account**
- depois disso custa **US$ 0,10 por job/mês**

Ou seja:

- 1 cron diário: normalmente **custo zero**
- 2 ou 3 crons: normalmente **custo zero**
- mesmo com vários crons, ainda tende a ser irrelevante

---

## 🛡️ Decisão técnica que vamos seguir

### Para limpeza histórica, vamos usar cron próprio em vez de TTL do Firestore

Motivo técnico:

- o **Firestore TTL não tem uso grátis**
- já a **deleção comum via job agendado** entra na lógica normal de deletes do Firestore

Para o volume esperado da UPEVA, isso é melhor porque:

- dá mais controle
- reduz risco operacional
- facilita auditoria
- tende a sair mais barato

---

## ✅ Direcionamento final

### Arquitetura que vamos implementar

- Firestore continua como banco operacional
- Cloud Functions continua como camada de regra de negócio
- Cloud Scheduler roda os arquivamentos
- Google Drive guarda contratos em PDF
- Google Sheets guarda índices e histórico leve

### Próxima sequência de implementação

1. criar o fluxo de arquivamento automático
2. criar a estrutura das planilhas por ano
3. guardar contratos no Drive e só indexar na planilha
4. adicionar motivo estruturado de rejeição
5. adicionar motivo estruturado de arquivamento de animal
6. ✅ 3.3 Rastreabilidade Mínima em Ações Críticas concluída: metadados mínimos ficam nos documentos operacionais, sem coleção `auditLog`, sem writes extras só para auditoria e sem PII; audit log completo fica adiado para reavaliação futura
7. limpar `rateLimits` e `_processedEvents`

---

## ❓FAQ — Perguntas frequentes

### “A plataforma já está pronta?”

**Está pronta na parte principal de operação.**
O que falta agora é amadurecer histórico, governança e retenção.

### “Vamos começar a pagar caro logo?”

**Não.**
Pelo desenho atual, a plataforma tende a ficar barata por bastante tempo.

### “A planilha substitui o banco?”

**Não.**
A planilha será o **arquivo histórico**, não o banco operacional.

### “Contrato vai para a planilha?”

**Melhor não.**
O contrato deve ficar no **Drive** e a planilha guarda o **link + índice**.

### “Só nome e nota já bastam para rejeitados?”

**Não é o ideal.**
Para conferência futura, o correto é manter também identificadores mais confiáveis.

---

## 🔎 Base oficial usada para preços

- Firebase Pricing: https://firebase.google.com/pricing
- Firestore Pricing: https://cloud.google.com/firestore/pricing
- Cloud Run Pricing: https://cloud.google.com/run/pricing
- Cloud Run Functions (1st gen) Pricing: https://cloud.google.com/functions/pricing-1stgen
- Cloud Scheduler Pricing: https://cloud.google.com/scheduler/pricing
- Cloud Storage Pricing: https://cloud.google.com/storage/pricing
- Cloud Functions locations: https://firebase.google.com/docs/functions/locations
