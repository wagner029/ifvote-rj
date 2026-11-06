# IFVote - Sistema Eletrônico de Votação e Gestão Eleitoral

Sistema completo de votação eletrônica baseado no IFVote, integrando Firebase Firestore e Firebase Auth para controle da comissão eleitoral, credenciamento presencial de eleitores por CPF/Matrícula, cabine de votação estilo Urna Eletrônica oficial com áudio e integridade estrita do voto secreto.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisões confirmadas com base nas respostas da fase de esclarecimentos:
> - **Validação e Liberação**: A comissão eleitoral valida o documento do eleitor (CPF ou Matrícula) no terminal do mesário e libera a urna diretamente com token seguro de uso único.
> - **Estilo da Cabine**: Interface fiel à Urna Eletrônica Brasileira (teclado numérico, fotos dos candidatos, sons característicos gerados via Web Audio API, botões BRANCO, CORRIGE, CONFIRMA e tela de FIM).
> - **Escopo Inicial da Eleição**: Eleição simples com cargo único configurável (ex: Grêmio Estudantil, Consulta de Direção Geral ou Coordenação), permitindo customização de candidatos, números, fotos e chapas.
> - **Sigilo e Integridade**: Os eleitores não precisam criar contas no Firebase; a comissão eleitoral autentica-se via Firebase Auth. A separação criptográfica/relacional entre a lista de eleitores que já votaram (`voters`) e o repositório de votos anônimos (`votes`) garante o sigilo do sufrágio enquanto impede voto duplo e assegura a conciliação exata (`total de eleitores que votaram == total de votos na urna`).

---

## 1. Overview & Core Concept

- **O que faz**: Oferece uma solução eleitoral completa para instituições de ensino e colegiados (IFRN/Institutos Federais e universidades), dividida em dois ambientes principais:
  1. **Mesa da Comissão Eleitoral (Painel Administrativo & Mesário)**: Autenticado com Firebase Auth, permite gerenciar a eleição, cadastrar e buscar eleitores aptos, verificar presença por documento (CPF/Matrícula), emitir a **Zerésima**, autorizar a urna na cabine em tempo real e gerar o **Boletim de Urna (BU)** final com apuração e auditoria.
  2. **Cabine de Votação (Terminal da Urna Eletrônica)**: Terminal protegido que aguarda a autorização do mesário. Uma vez liberado para um eleitor apto, exibe o painel de votação clássico (tela de fósforo/LCD com teclado de botões físicos simulados, feedback sonoro, pré-visualização de candidato ao digitar o número, voto em branco, correção e confirmação com o clássico som "pililili").
- **Público-Alvo**: Comissão eleitoral institucional, mesários e comunidade de eleitores (estudantes, professores, servidores técnico-administrativos).
- **Valor Principal**: Sigilo absoluto do voto, eliminação de fraude por voto duplo, agilidade na fila de votação e rastreabilidade com conformidade aos procedimentos eleitorais oficiais.

---

## 2. User Experience & Visual Design

### Fluxos Principais do Usuário

1. **Abertura da Eleição e Emissão da Zerésima**:
   - A comissão eleitoral realiza login via Firebase Auth.
   - Antes do início dos votos, emite e imprime/visualiza a **Zerésima** oficial comprovando que nenhum voto foi computado previamente na urna.
   - A eleição passa para o estado `EM_ANDAMENTO`.

2. **Recepção e Credenciamento do Eleitor**:
   - O eleitor chega à mesa com documento de identificação (CPF ou Matrícula institucional).
   - O mesário digita o documento no campo de busca rápida do painel.
   - O sistema valida se o eleitor está apto e confirma que ainda não votou (`hasVoted: false`).
   - O mesário clica em **"Autorizar Votação"**: o eleitor é marcado como votante e um passe de votação temporário de uso único é ativado para a cabine.

3. **Votação na Cabine (Urna Eletrônica)**:
   - A cabine sai da tela de espera e exibe "DIGITE O NÚMERO DO CANDIDATO".
   - O eleitor usa o teclado numérico na tela (ou teclado físico):
     - Digitação dos dígitos com bipe sonoro característico.
     - Exibição em tempo real do nome, chapa e foto do candidato correspondente.
     - Botão **BRANCO** para voto em branco.
     - Botão **CORRIGE** para reiniciar a digitação.
     - Botão **CONFIRMA** que grava o voto criptografado/anônimo e toca o som oficial da urna, exibindo a tela **FIM**.
   - A urna volta automaticamente para o estado bloqueado ("Aguardando liberação do mesário").

4. **Encerramento da Eleição e Apuração**:
   - A comissão encerra a votação e gera o **Boletim de Urna (BU)** com resumo de votos válidos, brancos, nulos, abstenções e hash de verificação de integridade.

### Identidade Visual e Estilo

- **Painel Administrativo**:
  - Estilo moderno SaaS institucional limpo, inspirado no design system de portais governamentais e acadêmicos.
  - Paleta equilibrada: Fundo neutro suave (`slate-50` / `slate-900`), acentos em verde esmeralda institucional (`emerald-700`), tipografia nítida (`Plus Jakarta Sans`), números tabulares (`tabular-nums` com `JetBrains Mono`) para dados quantitativos e auditoria.
  - Alertas discretos para status eleitoral (Aguardando início, Em andamento, Finalizada).
- **Cabine de Votação (Urna Eletrônica)**:
  - Fiel à carcaça da Urna Eletrônica do TSE/IF: tela com moldura interna e tipografia digital em caixa alta, teclado numérico com teclas cinza/pretas e os três clássicos botões na base:
    - **BRANCO** (tecla branca)
    - **CORRIGE** (tecla laranja)
    - **CONFIRMA** (tecla verde em destaque)
  - Áudio procedural Web Audio API (tons senoidais puros com envelopes precisos para o clique das teclas, alerta de erro e o acorde característico de confirmação "pililili").

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Modelo de Sigilo do Voto vs. Prevenção de Voto Duplo**:
  - *Abordagem*: Separação estrita em duas coleções do Firestore:
    1. `/elections/{electionId}/voters/{documentHash}`: Armazena CPF/Matrícula (com hash seguro), status de votação (`hasVoted: true`), data/hora do credenciamento e ID do mesário autorizador. **Não contém referência ao candidato votado.**
    2. `/elections/{electionId}/votes/{voteId}`: Armazena apenas o candidato escolhido (ou BRANCO/NULO), timestamp e hash de integridade sequencial. **Não contém nenhum vínculo ou identificador do eleitor.**
  - *Por que*: Garante o princípio constitucional do sigilo do voto, impossibilitando que qualquer membro da comissão ou invasor descubra o voto de um eleitor específico, enquanto impede matematicamente o voto duplo.
- **Decisão 2: Autenticação Segura via Firebase Auth**:
  - *Abordagem*: Autenticação restrita aos membros da comissão eleitoral credenciados. Eleitores não necessitam de conta de e-mail própria, garantindo rapidez e inclusão.
  - *Por que*: Evita atrito de criação de senhas/recuperação de e-mail pelos eleitores na hora da votação presencial, mantendo o controle total nas mãos da comissão oficial.
- **Decisão 3: Sons da Urna via Web Audio API Nativa**:
  - *Abordagem*: Sintetizador via `AudioContext` do navegador para reproduzir as frequências exatas dos bipes de tecla e do acorde de encerramento da Urna Eletrônica.
  - *Por que*: Não depende de arquivos de áudio externos que poderiam falhar ao carregar ou ser bloqueados por conexões instáveis.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SISTEMA IFVOTE-RIO                            │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Mesa Receptora / Comissão       │  Cabine de Votação (Urna Oficial)   │
│  - Login Firebase Auth           │  - Modo Terminal / Kiosk            │
│  - Cadastro e Busca de Eleitores │  - Validação de Sessão Ativa        │
│  - Validação CPF/Matrícula       │  - Teclado Numérico + Sons WebAudio │
│  - Liberação de Terminal         │  - Pré-visualização de Candidato    │
│  - Zerésima e Boletim de Urna    │  - Voto em Branco, Corrige, Confirma│
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FIREBASE BACKEND SERVICES                       │
├──────────────────────────────────┬─────────────────────────────────────┤
│          FIREBASE AUTH           │          FIRESTORE DATABASE         │
│  - Administradores / Comissões   │  /elections/{id}                    │
│  - Sessão Segura e RBAC          │  /elections/{id}/candidates/{candId}│
│                                  │  /elections/{id}/voters/{voterId}   │
│                                  │  /elections/{id}/votes/{voteId}     │
│                                  │  /elections/{id}/audit_logs/{logId} │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### Modelo de Dados no Firestore (`firebase-blueprint.json`)

1. **`elections`**:
   - `id`: string
   - `title`: string (ex: "Eleição Grêmio Estudantil IFRN")
   - `status`: enum ("CONFIGURACAO" | "ABERTA" | "ENCERRADA")
   - `createdAt`, `openedAt`, `closedAt`: timestamp
   - `officeTitle`: string (ex: "Diretoria Geral do Grêmio")
   - `allowedVotersCount`: number
   - `votedCount`: number
   - `boletimUrna`: map com totais apurados e hash de fechamento
2. **`candidates`**:
   - `id`: string
   - `number`: string (2 dígitos, ex: "10", "20")
   - `name`: string
   - `ballotName`: string
   - `chapa`: string
   - `photoUrl`: string (com fallback SVG/vetorial de alta qualidade)
   - `viceName`: string
3. **`voters`** (Credenciamento):
   - `id`: string (hash do CPF ou Matrícula)
   - `name`: string
   - `identifier`: string (CPF ou Matrícula mascarada)
   - `category`: string ("Discente" | "Docente" | "TAE")
   - `hasVoted`: boolean
   - `votedAt`: timestamp ou null
   - `authorizedBy`: string (uid da comissão)
4. **`votes`** (Votos Anônimos):
   - `id`: string
   - `type`: enum ("CANDIDATE" | "BRANCO" | "NULO")
   - `candidateNumber`: string ou null
   - `createdAt`: serverTimestamp
5. **`booth_sessions`** (Controle da Cabine):
   - `id`: "current"
   - `status`: enum ("WAITING_AUTHORIZATION" | "VOTING" | "FINISHED")
   - `authorizedAt`: timestamp
   - `expiresAt`: timestamp
   - `token`: string

---

## 5. Implementation Stages (Pós-Aprovação)

1. **Provisionamento Firebase**:
   - Chamar `show_aistudio_ui` para aceitação dos termos de Firebase pelo usuário.
   - Provisionar Firestore e Auth via RPC.
2. **Definição de Blueprint e Regras**:
   - Criar `firebase-blueprint.json` e `firestore.rules` com validação estrita (Master Gate, Anti-Update-Gap e proteção contra votos duplicados).
3. **Implementação dos Módulos**:
   - Módulo de Áudio da Urna (`useUrnaSound.ts`) com Web Audio API.
   - Componente da Cabine da Urna Eletrônica (`UrnaScreen.tsx`, `UrnaKeyboard.tsx`).
   - Painel do Mesário e Comissão Eleitoral (`AdminDashboard.tsx`, `VoterManager.tsx`, `CandidateManager.tsx`).
   - Emissão de relatórios oficiais (Zerésima e Boletim de Urna).
4. **Validação e Compilação**:
   - Teste de fluxo de votação com integridade do voto e `compile_applet`.
