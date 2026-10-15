"""Conteúdo — parte 2: casos de uso, fluxos, dados, telas, arquitetura e fecho."""

from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer, PageBreak

import diagramas as dg
from documento import E, LARG_UTIL, p, h1, h2, figura, quadro

L = LARG_UTIL


# ===================== 9 Casos de uso =====================

def _caso(codigo, nome, ator, pre, principal, alternativos, excecoes, pos):
    linhas = [["Campo", "Descrição"],
              ["Identificador", codigo],
              ["Nome", nome],
              ["Ator principal", ator],
              ["Pré-condições", pre],
              ["Fluxo principal", "<br/>".join(
                  f"{i}. {s}" for i, s in enumerate(principal, 1))],
              ["Fluxos alternativos", "<br/>".join(alternativos)],
              ["Fluxos de exceção", "<br/>".join(excecoes)],
              ["Pós-condições", pos]]
    return quadro(f"Caso de uso {codigo} — {nome}", linhas, [3.6 * cm, L - 3.6 * cm])


def casos_uso():
    itens = [h1("9", "Casos de uso")]
    itens.append(p("Esta seção detalha os casos de uso mais relevantes do sistema. "
                   "Para cada um, são descritos o fluxo principal, as variações "
                   "válidas e as situações de exceção tratadas. O diagrama geral de "
                   "casos de uso foi apresentado na Figura 1."))

    itens.append(h2("9.1", "Inscrever-se em atividade"))
    itens += _caso(
        "UC-01", "Inscrever-se em atividade", "Estudante",
        "Estudante autenticado, com perfil mínimo preenchido; atividade publicada "
        "e com vaga disponível",
        ["O estudante localiza a atividade na vitrine",
         "O estudante aciona a inscrição",
         "O sistema verifica vaga, duplicidade, perfil e limite de inscrições",
         "O sistema registra a inscrição",
         "O sistema confirma a operação e atualiza o total de vagas"],
        ["A1. Exigindo aprovação, a inscrição fica pendente até decisão da organização",
         "A2. Sendo a última vaga, a atividade permanece visível, sem aceitar novas "
         "inscrições"],
        ["E1. Estudante já inscrito: a operação é recusada",
         "E2. Vagas esgotadas no intervalo: o sistema informa e atualiza a tela",
         "E3. Perfil incompleto: o estudante é conduzido ao preenchimento (RN-13)",
         "E4. Limite de cinco inscrições atingido: a operação é recusada (RN-14)"],
        "Inscrição registrada e uma vaga ocupada")

    itens.append(PageBreak())
    itens.append(h2("9.2", "Registrar presença por código QR"))
    itens += _caso(
        "UC-02", "Registrar presença por código QR", "Estudante",
        "Inscrição confirmada em atividade em andamento",
        ["A organização exibe o código QR no local do evento",
         "O estudante abre a leitura de código no sistema",
         "O estudante aponta a câmera para o código exibido",
         "O sistema valida assinatura, janela temporal e vínculo com a atividade",
         "O sistema registra a presença e confirma ao estudante"],
        ["A1. Sem câmera disponível, o estudante informa o código manualmente",
         "A2. Sem dispositivo móvel, a organização registra a presença por ele (RN-17)",
         "A3. O navegador não responde ao pedido de localização: após quatro "
         "segundos, o registro segue sem ela"],
        ["E1. Código expirado: o sistema orienta nova leitura — situação prevista, "
         "decorrente da rotação a cada trinta segundos",
         "E2. Código de outra atividade: a operação é recusada",
         "E3. Presença já registrada: a operação é recusada",
         "E4. Atividade fora do horário: o registro não é aceito (RN-15)"],
        "Presença registrada como evidência, sujeita à confirmação da organização")

    itens.append(PageBreak())
    itens.append(h2("9.3", "Verificar autenticidade de certificado"))
    itens += _caso(
        "UC-03", "Verificar autenticidade de certificado", "Verificador",
        "Posse do código de verificação ou do código QR impresso no certificado",
        ["O verificador lê o código QR do certificado",
         "O navegador acessa a página pública de verificação",
         "O sistema localiza o registro pelo código informado",
         "O sistema confere a assinatura digital do registro",
         "O sistema apresenta os dados e a situação da verificação"],
        ["A1. O verificador informa o código manualmente",
         "A2. O verificador obtém o arquivo PDF diretamente da fonte, sem depender "
         "do documento recebido",
         "A3. O verificador obtém o texto assinado, a assinatura e a chave pública e "
         "confere com ferramenta própria, sem confiar na resposta da plataforma"],
        ["E1. Código inexistente: informa que nenhum certificado corresponde",
         "E2. Certificado revogado: apresenta os dados com a devida advertência "
         "(RN-35)",
         "E3. Assinatura divergente: alerta de adulteração do registro"],
        "Autenticidade confirmada ou recusada, sem necessidade de contato com a "
        "organização emissora")

    itens.append(PageBreak())
    itens.append(h2("9.4", "Entrar com provedor externo"))
    itens += _caso(
        "UC-04", "Entrar com provedor externo",
        "Estudante ou organização; provedor de identidade como ator secundário",
        "Provedor com credencial configurada no servidor; usuário com conta no "
        "provedor e e-mail verificado",
        ["O usuário escolhe entrar com Google, Microsoft ou GitHub",
         "O sistema gera o estado e o verificador PKCE, guarda-os em cookie assinado "
         "de dez minutos e redireciona ao provedor",
         "O usuário autentica-se no site do provedor e autoriza o acesso",
         "O provedor devolve o usuário ao sistema com um código de uso único",
         "O sistema confere o estado e troca o código, apresentando o verificador "
         "e o segredo do aplicativo",
         "O sistema confirma a identidade: pela assinatura do token de identidade, "
         "no Google e na Microsoft, ou pela consulta à interface do GitHub",
         "Localizada a conta pelo par provedor e identificador (RN-27), o sistema "
         "abre a sessão"],
        ["A1. Primeiro acesso: o cadastro fica pendente e o usuário escolhe entre "
         "estudante e organização; só então a conta é criada (RN-31)",
         "A2. E-mail já cadastrado: a identidade é vinculada à conta existente, e o "
         "vínculo é auditado (RN-30)",
         "A3. Domínio institucional comprovado pelo provedor: a conta recebe o selo "
         "de vínculo (RN-33)"],
        ["E1. O usuário recusa a autorização no provedor: volta ao acesso com aviso",
         "E2. Estado divergente, expirado ou iniciado por outro provedor: a entrada "
         "é recusada",
         "E3. E-mail não verificado, ou conta institucional da Microsoft sem "
         "atestação: a entrada é recusada (RN-28, RN-29)",
         "E4. Conta suspensa: a sessão não é aberta",
         "E5. Provedor sem credencial: a opção não é exibida (RN-34)"],
        "Sessão aberta e acesso auditado, sem que a senha do provedor tenha passado "
        "pela plataforma")
    itens.append(PageBreak())
    return itens


# ===================== 10 Fluxos =====================

def fluxos():
    itens = [h1("10", "Fluxos do sistema"), h2("10.1", "Fluxo principal")]
    itens.append(p("O fluxo principal do sistema percorre os três atores externos, "
                   "da publicação da atividade até a verificação do certificado pela "
                   "coordenação acadêmica."))
    itens += figura(dg.fluxo_processo(), "Fluxo principal do processo")
    itens.append(p("O processo é assíncrono entre os atores: a organização publica sem "
                   "saber quem se inscreverá, o estudante se inscreve sem interação "
                   "direta, e o verificador atua depois de concluído todo o ciclo, "
                   "possivelmente meses após a atividade."))

    itens.append(h2("10.2", "Fluxos alternativos e de exceção"))
    itens.append(p("Além do caminho principal, o sistema prevê variações válidas e "
                   "situações de erro tratadas, sintetizadas no quadro a seguir."))
    dados = [
        ["Situação", "Tratamento previsto"],
        ["Atividade exige aprovação",
         "A inscrição permanece pendente e a vaga fica reservada até a decisão da "
         "organização"],
        ["Estudante desiste antes do evento",
         "A inscrição é cancelada e a vaga retorna à disponibilidade"],
        ["Estudante sem dispositivo móvel",
         "A organização registra a presença manualmente, com origem distinta "
         "registrada"],
        ["Código QR fotografado e repassado",
         "O código expira em trinta segundos, tornando o repasse inútil"],
        ["Participante sem decisão de presença",
         "O encerramento da atividade é bloqueado até que todos sejam avaliados"],
        ["Organização não encerra a atividade",
         "O administrador pode destravar o processo, mediante justificativa "
         "registrada"],
        ["Certificado emitido indevidamente",
         "Pode ser revogado com justificativa; o registro é preservado"],
        ["Sessão expirada durante o uso",
         "A sessão é renovada automaticamente, sem interromper a operação"],
        ["Falha de comunicação em operação de escrita",
         "A operação não é repetida automaticamente, evitando duplicidade de "
         "certificados"],
        ["Pedido de localização ignorado no registro de presença",
         "Após quatro segundos, o registro prossegue sem a localização, antes que "
         "o código expire"],
        ["Evento do dia já encerrado",
         "Deixa de ser destacado no painel do estudante"],
        ["Novo usuário desiste na escolha do perfil",
         "Nenhuma conta é criada; o cadastro pendente expira em quinze minutos"],
        ["Mesmo e-mail em outro provedor",
         "A nova identidade é vinculada à conta existente"],
        ["Retorno do provedor fora de ordem ou de outro provedor",
         "O estado não confere, a entrada é recusada e o usuário volta ao acesso "
         "com aviso"],
    ]
    itens += quadro("Fluxos alternativos e de exceção", dados,
                    [5.2 * cm, L - 5.2 * cm])
    itens.append(PageBreak())

    itens.append(h2("10.3", "Fluxo de entrada por provedor externo"))
    itens.append(p("A entrada por Google, Microsoft e GitHub segue o mesmo fluxo de "
                   "código de autorização com PKCE. A senha é digitada no site do "
                   "provedor, e o código devolvido ao navegador não tem valor sem o "
                   "verificador, que permanece em cookie assinado."))
    itens += figura(dg.fluxo_oauth(), "Fluxo de entrada por provedor externo")
    itens.append(p("A diferença entre os provedores está no passo 6. Google e "
                   "Microsoft seguem o OpenID Connect e devolvem um token de "
                   "identidade assinado, conferido pelas chaves públicas do provedor. "
                   "O GitHub segue o OAuth 2.0 puro e devolve apenas um token de "
                   "acesso, com o qual o sistema consulta quem é a pessoa e quais "
                   "e-mails ela tem verificados."))
    itens.append(PageBreak())
    return itens


# ===================== 11 Modelagem de dados =====================

def modelagem():
    itens = [h1("11", "Modelagem de dados"), h2("11.1", "Diagrama entidade-relacionamento")]
    itens.append(p("O modelo de dados foi projetado sobre banco relacional, com as "
                   "restrições de integridade declaradas no próprio banco sempre que "
                   "possível. Os dados de perfil de estudante e de organização foram "
                   "separados em tabelas distintas, permitindo que o banco exija os "
                   "campos pertinentes a cada tipo de conta."))
    itens += figura(dg.der_principal(), "Diagrama entidade-relacionamento — "
                                        "entidades principais")
    itens.append(PageBreak())
    itens.append(p("Além das entidades principais, o sistema mantém tabelas de apoio "
                   "responsáveis por sessão, redefinição de senha, identidade externa, "
                   "notificação e auditoria.", "corpo"))
    itens += figura(dg.der_apoio(), "Entidades de apoio ao sistema")
    itens.append(p("A tabela de auditoria não mantém chave estrangeira para a tabela "
                   "de usuários. A decisão é deliberada: caso a conta investigada "
                   "fosse removida, uma exclusão em cascata eliminaria justamente o "
                   "registro necessário à investigação."))
    itens.append(p("Na tabela de identidades externas, a chave única é o par "
                   "provedor e identificador, e não o e-mail. O e-mail muda no "
                   "provedor e, em domínio corporativo, pode ser reatribuído a outra "
                   "pessoa: usá-lo como chave transformaria essa troca em mudança "
                   "silenciosa de dono da conta. Pela mesma razão, a senha passou a "
                   "ser opcional em <i>usuarios</i>, pois quem se cadastra por provedor "
                   "externo não define senha na plataforma."))

    itens.append(h2("11.2", "Dicionário de dados"))
    dados = [
        ["Entidade", "Finalidade"],
        ["usuarios", "Identidade e credencial de acesso, comum a todos os perfis"],
        ["perfis_estudante", "Dados acadêmicos e pessoais do estudante"],
        ["perfis_ong", "Dados institucionais da organização"],
        ["atividades", "Oportunidade de extensão publicada pela organização"],
        ["inscricoes", "Vínculo entre estudante e atividade, incluindo evidência de "
                       "presença e decisão final"],
        ["certificados", "Comprovante emitido, com código público e assinatura digital"],
        ["tokens_sessao", "Credenciais de renovação de sessão, armazenadas como resumo"],
        ["tokens_redefinicao", "Vínculos temporários para redefinição de senha"],
        ["identidades_externas", "Contas Google, Microsoft ou GitHub ligadas ao "
                                 "usuário, com o domínio que sustenta o selo "
                                 "institucional"],
        ["notificacoes", "Avisos exibidos ao usuário dentro do sistema"],
        ["registros_auditoria", "Trilha somente de inserção das ações executadas"],
    ]
    itens += quadro("Dicionário de entidades", dados, [4.2 * cm, L - 4.2 * cm])
    itens.append(PageBreak())
    return itens


# ===================== 12 Máquinas de estado =====================

def estados():
    itens = [h1("12", "Máquinas de estado")]
    itens.append(p("A modelagem dos estados precede a definição das interfaces, uma vez "
                   "que as ações disponíveis em cada tela derivam diretamente do estado "
                   "em que o objeto se encontra. Uma atividade encerrada, por exemplo, "
                   "não apresenta a ação de encerramento."))
    itens.append(h2("12.1", "Estados da atividade"))
    itens += figura(dg.estados_atividade(), "Máquina de estados da atividade")
    itens.append(p("Dois estados — <i>em andamento</i> e <i>aguardando validação</i> — "
                   "não são gravados no banco de dados. Eles resultam da comparação "
                   "entre o horário registrado da atividade e o momento da consulta. "
                   "Essa decisão elimina a necessidade de processo em segundo plano "
                   "para atualizar estados, o que evita falhas silenciosas e defasagem "
                   "entre o horário real e o percebido pelo sistema."))
    itens.append(PageBreak())
    itens.append(h2("12.2", "Estados da inscrição"))
    itens += figura(dg.estados_inscricao(), "Máquina de estados da inscrição")
    itens.append(p("Cabe distinguir <b>registro de presença</b> de <b>presença "
                   "confirmada</b>. O primeiro é a evidência produzida pela leitura do "
                   "código QR; a segunda é a decisão da organização, tomada à luz "
                   "dessa evidência. Somente a presença confirmada origina certificado."))
    itens.append(PageBreak())
    return itens


# ===================== 13 Interfaces =====================

def interfaces():
    itens = [h1("13", "Interfaces do sistema")]
    itens.append(p("A plataforma organiza-se em quatro áreas de navegação, com "
                   "identidade visual própria e público distinto, reunidas em uma "
                   "única aplicação e um único ponto de autenticação."))
    dados = [
        ["Área", "Público", "Telas previstas"],
        ["Portal", "Visitante e verificador",
         "Início, Como funciona, Para estudantes, Para organizações, Organizações "
         "parceiras e perfil público, Vagas abertas, Verificação de certificado, "
         "Acesso e Cadastro"],
        ["Área do estudante", "Estudante",
         "Painel, Vitrine de atividades, Detalhe da atividade, Minhas inscrições, "
         "Registro de presença, Meus certificados, Notificações e Perfil"],
        ["Painel da organização", "Organização",
         "Painel, Minhas atividades, Criação e edição, Gestão da atividade, "
         "Inscrições, Painel de presença, Validação e Notificações"],
        ["Console administrativo", "Administrador",
         "Visão geral, Auditoria, Contas, Organizações, Atividades, Certificados, "
         "Parâmetros do sistema e Visualização como usuário"],
    ]
    itens += quadro("Áreas de navegação e telas", dados,
                    [3.6 * cm, 3.4 * cm, L - 7 * cm])
    itens.append(p("O acesso é único para todos os perfis: o destino após a "
                   "autenticação decorre do papel do usuário. Não há endereço "
                   "específico de acesso administrativo, opção que evita sinalizar a "
                   "existência de área privilegiada a eventual atacante."))
    itens.append(p("As telas de acesso e de cadastro exibem, abaixo do formulário, uma "
                   "opção para cada provedor externo configurado. Na volta do "
                   "provedor, quem já tem conta segue direto para o seu painel; quem "
                   "chega pela primeira vez escolhe entre estudante e organização. "
                   "Recusas do provedor retornam à tela de acesso com mensagem que "
                   "nomeia o provedor e o motivo."))
    itens.append(p("Os painéis de entrada abrem com um único destaque, escolhido pelo "
                   "servidor conforme a situação do usuário: para o estudante, o "
                   "registro de presença em andamento, o evento do dia ou um "
                   "certificado novo; para a organização, o código QR em exibição, "
                   "presenças a validar, inscrições pendentes ou rascunho parado."))
    return itens


# ===================== 14 Arquitetura =====================

def arquitetura():
    itens = [h1("14", "Arquitetura e tecnologias")]
    dados = [
        ["Camada", "Tecnologia", "Justificativa"],
        ["Interface", "React com Vite",
         "Componentização, recarga rápida em desenvolvimento e ampla adoção"],
        ["Componentes visuais", "Mantine",
         "Biblioteca com acessibilidade e responsividade nativas"],
        ["Serviço", "Python com FastAPI",
         "Validação declarativa de entrada e documentação de interface automática"],
        ["Persistência", "PostgreSQL",
         "Suporte a restrições de integridade, tipos apropriados e transações"],
        ["Mapeamento", "SQLAlchemy",
         "Abstração de acesso a dados com consultas parametrizadas"],
        ["Versionamento de esquema", "Alembic",
         "Evolução controlada e reproduzível do banco de dados"],
        ["Assinatura digital", "Ed25519",
         "Assinatura compacta e verificação rápida"],
        ["Entrada externa", "OAuth 2.0 e OpenID Connect",
         "Protocolos padronizados; a senha permanece com o provedor"],
        ["Implantação", "Docker e Caddy",
         "Ambiente reproduzível e HTTPS com certificado renovado sozinho"],
        ["Integração contínua", "GitHub Actions",
         "Testes, migrações e publicação automática a cada alteração"],
        ["Hospedagem", "Máquina virtual no Microsoft Azure",
         "Servidor próprio, com disco persistente para banco e arquivos"],
    ]
    itens.append(h2("14.1", "Tecnologias"))
    itens.append(p("A plataforma adota arquitetura cliente-servidor, com interface web "
                   "responsiva consumindo uma interface de programação sobre protocolo "
                   "HTTP."))
    itens += quadro("Tecnologias adotadas e respectivas justificativas", dados,
                    [3.4 * cm, 3.6 * cm, L - 7 * cm])
    itens.append(p("O fluxo de cada requisição é padronizado: a rota declara a "
                   "autenticação e o perfil exigidos, os dados de entrada são "
                   "validados por esquema, a regra de negócio é aplicada na camada de "
                   "serviço e o acesso ao banco ocorre por mapeamento objeto-relacional."))
    itens.append(PageBreak())

    itens.append(h2("14.2", "Implantação e publicação contínua"))
    itens.append(p("A plataforma está publicada em máquina virtual própria. Um "
                   "servidor Caddy recebe todo o tráfego, obtém e renova "
                   "sozinho o certificado HTTPS, entrega a interface já compilada e "
                   "repassa à API apenas as rotas do serviço. O banco de dados não "
                   "expõe porta para fora da máquina."))
    itens += figura(dg.implantacao(), "Implantação e publicação contínua")
    itens.append(p("Cada alteração enviada ao repositório dispara a integração "
                   "contínua: a suíte de testes do serviço roda contra um banco "
                   "descartável, as migrações são aplicadas, revertidas e aplicadas "
                   "de novo, e a interface passa pela análise estática e pela "
                   "compilação. Somente com todas as etapas aprovadas a máquina "
                   "virtual publica exatamente a versão testada, identificada pelo "
                   "seu SHA, e a publicação só termina quando o serviço responde à "
                   "verificação de saúde."))
    itens.append(p("A conexão com a máquina é fixada pela identidade do servidor, o "
                   "que impede que um impostor receba a publicação, e a chave usada "
                   "pela integração contínua só consegue executar o roteiro de "
                   "publicação. Uma cópia do banco é feita diariamente e guardada "
                   "por catorze dias."))
    itens.append(PageBreak())
    return itens


# ===================== 15 Segurança =====================

def seguranca():
    itens = [h1("15", "Segurança e desafio tecnológico")]
    itens.append(p("O desafio tecnológico central deste projeto consiste em garantir "
                   "que a hora de extensão comprovada seja verdadeira. Três camadas "
                   "complementares tratam do problema (15.1 a 15.3), e uma quarta "
                   "permite que terceiros confiram a assinatura sem depender da "
                   "plataforma (15.4). A entrada por provedores externos, acrescentada "
                   "durante a construção, é tratada em 15.5."))

    itens.append(h2("15.1", "Autenticidade do certificado"))
    itens.append(p("Cada certificado recebe código de verificação único e página "
                   "pública de consulta, acessível por código QR. A verificação "
                   "consulta a base de dados, e não o arquivo apresentado, o que torna "
                   "irrelevante qualquer edição feita no documento entregue."))

    itens.append(h2("15.2", "Registro de presença por código rotativo"))
    itens.append(p("Durante a atividade, a organização exibe um código QR que se "
                   "renova a cada trinta segundos. O estudante registra presença "
                   "lendo esse código. Como o valor exibido é derivado da janela "
                   "temporal corrente e de chave secreta do servidor, a fotografia do "
                   "código repassada a terceiro chega expirada."))
    itens.append(p("Para que a fraude fosse bem-sucedida, seria necessário que um "
                   "cúmplice presente ao evento enviasse nova imagem a cada trinta "
                   "segundos, em tempo real — esforço superior ao de simplesmente "
                   "comparecer."))

    itens.append(h2("15.3", "Assinatura digital do certificado"))
    itens.append(p("A verificação por consulta à base resolve a adulteração do "
                   "arquivo, mas não cobre a hipótese de escrita indevida diretamente "
                   "no banco de dados. Nesse cenário, um registro fraudulento seria "
                   "localizado pela consulta e considerado autêntico."))
    itens.append(p("Para tratar essa hipótese, cada certificado é assinado com chave "
                   "privada mantida fora do banco de dados. A verificação confere a "
                   "assinatura além de localizar o registro. Quem obtenha acesso de "
                   "escrita ao banco não consegue produzir assinatura válida, e a "
                   "adulteração passa a ser detectável."))
    itens.append(p("A assinatura cobre todos os dados exibidos na verificação: "
                   "participante, organização, atividade, carga horária, data da "
                   "atividade e data de emissão. A alteração de qualquer um deles, "
                   "mesmo do nome da organização, invalida a assinatura."))

    itens.append(h2("15.4", "Conferência independente da assinatura"))
    itens.append(p("Até aqui, quem consulta a verificação precisa confiar na resposta "
                   "da plataforma. Para que a validação seja demonstrável, e não "
                   "apenas afirmada, cada certificado expõe publicamente três "
                   "elementos: o texto exatamente como foi assinado, a assinatura e "
                   "a chave pública. Com eles, qualquer pessoa confere o certificado "
                   "com biblioteca criptográfica própria, sem executar código da "
                   "plataforma."))
    itens.append(p("A chave pública é divulgada de propósito, pois existe para "
                   "circular: não permite assinar, apenas conferir. O certificado "
                   "revogado também tem a prova disponível, e ela confere, já que a "
                   "revogação é decisão posterior da instituição, não falsificação. "
                   "O teste automatizado mais importante dessa camada confere a "
                   "assinatura diretamente na biblioteca criptográfica, sem usar o "
                   "verificador da plataforma, de modo que um erro nele não passaria "
                   "despercebido."))

    itens.append(h2("15.5", "Entrada por provedores externos"))
    itens.append(p("A entrada por Google, Microsoft e GitHub delega a autenticação a "
                   "quem já a faz em escala, mas abre um risco próprio: aceitar do "
                   "provedor uma identidade que ele não garantiu. O sistema trata "
                   "esse risco com quatro decisões. A conta é reconhecida pelo par "
                   "provedor e identificador estável, nunca pelo e-mail. Só é aceito "
                   "e-mail verificado pelo provedor. O estado e o verificador PKCE "
                   "ficam em cookie assinado que registra também qual provedor "
                   "iniciou o fluxo, de modo que o retorno de um não conclui a "
                   "entrada iniciada por outro. Por fim, nenhum token trafega na URL: "
                   "a sessão é aberta pelo mesmo cookie seguro da entrada por senha."))
    itens.append(p("A exigência de e-mail verificado é o que torna seguro reunir "
                   "provedores na mesma conta. Sem ela, bastaria criar em qualquer "
                   "provedor uma conta com o e-mail de outra pessoa para assumir a "
                   "conta dela na plataforma."))
    provedores = [
        ["Provedor", "Protocolo", "Origem da identidade", "Cuidado específico"],
        ["Google", "OpenID Connect",
         "Token de identidade assinado, conferido pelas chaves públicas do Google",
         "Domínio informado pelo Google sustenta o selo institucional"],
        ["Microsoft", "OpenID Connect",
         "Token de identidade assinado; emissor conferido contra o locatário",
         "E-mail de conta institucional só com a atestação de verificação "
         "(ataque conhecido como nOAuth)"],
        ["GitHub", "OAuth 2.0",
         "Consulta à interface do GitHub com o token obtido na troca",
         "Erro devolvido com status de sucesso; conta guardada pelo "
         "identificador numérico, pois o nome de usuário muda"],
    ]
    itens += quadro("Diferenças entre os provedores externos", provedores,
                    [2.4 * cm, 2.8 * cm, 5.4 * cm, L - 10.6 * cm])

    dados = [
        ["Camada", "Ameaça tratada", "Mecanismo"],
        ["Verificação pública", "Edição do arquivo PDF entregue",
         "Consulta do código à base de dados"],
        ["Código QR rotativo", "Registro de presença por quem não compareceu",
         "Código derivado de janela temporal de trinta segundos"],
        ["Assinatura digital", "Inserção fraudulenta no banco de dados",
         "Assinatura Ed25519 com chave mantida fora do banco"],
        ["Prova pública", "Plataforma que afirme validade sem tê-la conferido",
         "Texto assinado, assinatura e chave pública conferidos por terceiros"],
        ["Entrada externa", "Tomada de conta com e-mail alheio",
         "E-mail verificado exigido e conta identificada por provedor e "
         "identificador"],
    ]
    itens += quadro("Camadas de proteção e ameaças correspondentes", dados,
                    [3.6 * cm, 5.2 * cm, L - 8.8 * cm])
    itens.append(PageBreak())
    return itens


# ===================== 16 Considerações finais =====================

def consideracoes():
    itens = [h1("16", "Considerações finais")]
    itens.append(p("Este documento especificou os requisitos de uma plataforma "
                   "destinada a conectar estudantes e organizações da sociedade civil "
                   "para a realização de atividades de extensão, com ênfase na "
                   "comprovação confiável das horas cumpridas."))
    itens.append(p("A principal contribuição da especificação está em tratar a "
                   "comprovação como problema de integridade da informação. Ao "
                   "combinar verificação pública, registro de presença por código "
                   "rotativo e assinatura digital, o sistema desloca a confiança do "
                   "documento para a informação registrada e assinada."))
    itens.append(p("Foram especificados trinta requisitos funcionais, dezessete "
                   "requisitos não funcionais e trinta e nove regras de negócio, além "
                   "do modelo de dados com onze entidades e do detalhamento das "
                   "interfaces. A modelagem priorizou a declaração de restrições no "
                   "próprio banco de dados sempre que possível, reduzindo a "
                   "dependência de verificações na aplicação."))
    itens.append(p("A plataforma foi implementada conforme esta especificação e está "
                   "publicada em servidor próprio, com publicação contínua. Durante a "
                   "construção, o escopo foi ampliado com a entrada por Google, "
                   "Microsoft e GitHub, a prova pública da assinatura, os painéis de "
                   "entrada e o portal institucional, todos incorporados a esta "
                   "versão do documento."))
    itens.append(p("Como continuidade, prevê-se piloto com organizações parceiras. "
                   "Entre as evoluções mapeadas estão o envio real de correio "
                   "eletrônico, hoje necessário à recuperação de senha em escala, a "
                   "cópia de segurança do banco fora do servidor, a exportação de "
                   "relatórios para as coordenações e a assinatura no padrão "
                   "ICP-Brasil."))
    return itens


# ===================== Referências =====================

def referencias():
    refs = [
        "ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 14724</b>: informação e "
        "documentação: trabalhos acadêmicos: apresentação. Rio de Janeiro: ABNT, 2011.",
        "BRASIL. Ministério da Educação. Conselho Nacional de Educação. "
        "<b>Resolução CNE/CES nº 7, de 18 de dezembro de 2018</b>. Estabelece as "
        "Diretrizes para a Extensão na Educação Superior Brasileira. Brasília: MEC, 2018.",
        "BERNSTEIN, D. J. et al. High-speed high-security signatures. "
        "<b>Journal of Cryptographic Engineering</b>, v. 2, n. 2, p. 77-89, 2012.",
        "BIRYUKOV, A.; DINU, D.; KHOVRATOVICH, D. Argon2: new generation of memory-hard "
        "functions for password hashing and other applications. In: "
        "<b>IEEE European Symposium on Security and Privacy</b>, 2016, Saarbrücken. "
        "Anais [...]. Saarbrücken: IEEE, 2016. p. 292-302.",
        "M'RAIHI, D. et al. <b>RFC 6238</b>: TOTP: Time-Based One-Time Password "
        "Algorithm. Internet Engineering Task Force, 2011.",
        "HARDT, D. (ed.). <b>RFC 6749</b>: The OAuth 2.0 Authorization Framework. "
        "Internet Engineering Task Force, 2012.",
        "JOSEFSSON, S.; LIUSVAARA, I. <b>RFC 8032</b>: Edwards-Curve Digital "
        "Signature Algorithm (EdDSA). Internet Engineering Task Force, 2017.",
        "SAKIMURA, N.; BRADLEY, J.; AGARWAL, N. <b>RFC 7636</b>: Proof Key for Code "
        "Exchange by OAuth Public Clients. Internet Engineering Task Force, 2015.",
        "SAKIMURA, N. et al. <b>OpenID Connect Core 1.0</b>. OpenID Foundation, 2014.",
        "PRESSMAN, R. S.; MAXIM, B. R. <b>Engenharia de software</b>: uma abordagem "
        "profissional. 8. ed. Porto Alegre: AMGH, 2016.",
        "SOMMERVILLE, I. <b>Engenharia de software</b>. 10. ed. São Paulo: Pearson, 2018.",
    ]
    itens = [Paragraph("REFERÊNCIAS", E["h1"])]
    for r in sorted(refs):
        itens.append(Paragraph(r, E["ref"]))
    return itens
