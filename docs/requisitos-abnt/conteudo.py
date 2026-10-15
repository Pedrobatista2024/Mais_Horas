"""Conteúdo textual do Documento de Requisitos — Mais Horas."""

from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer, PageBreak, NextPageTemplate
from reportlab.platypus.tableofcontents import TableOfContents

import diagramas as dg
from documento import E, F, FB, LARG_UTIL, p, h1, h2, figura, quadro, tabela

L = LARG_UTIL


# ===================== Pré-textuais =====================

def capa():
    return [
        Spacer(1, 0.5 * cm),
        Paragraph("CENTRO UNIVERSITÁRIO CEARENSE — UniC", E["capa_inst"]),
        Paragraph("CURSO DE SISTEMAS DE INFORMAÇÃO", E["capa_inst"]),
        Spacer(1, 3.5 * cm),
        Paragraph("PEDRO BATISTA", E["capa_sub"]),
        Paragraph("ISMAEL BRANDÃO", E["capa_sub"]),
        Paragraph("ANTÔNIO YARLEN", E["capa_sub"]),
        Spacer(1, 3.5 * cm),
        Paragraph("MAIS HORAS", E["capa_titulo"]),
        Spacer(1, 0.5 * cm),
        Paragraph("DOCUMENTO DE REQUISITOS DE UMA PLATAFORMA DE GESTÃO "
                  "DE HORAS DE EXTENSÃO COM CERTIFICAÇÃO VERIFICÁVEL "
                  "POR QR CODE", E["capa_sub"]),
        Spacer(1, 6 * cm),
        Paragraph("FORTALEZA — CE", E["capa_inst"]),
        Paragraph("2026", E["capa_inst"]),
        PageBreak(),
    ]


def folha_rosto():
    nota = ("Documento de requisitos apresentado à disciplina de Projeto "
            "Integrador I do curso de Sistemas de Informação do Centro "
            "Universitário Cearense, como requisito parcial para avaliação.")
    return [
        Spacer(1, 0.5 * cm),
        Paragraph("PEDRO BATISTA", E["capa_sub"]),
        Paragraph("ISMAEL BRANDÃO", E["capa_sub"]),
        Paragraph("ANTÔNIO YARLEN", E["capa_sub"]),
        Spacer(1, 4 * cm),
        Paragraph("MAIS HORAS", E["capa_titulo"]),
        Spacer(1, 0.4 * cm),
        Paragraph("Documento de requisitos de uma plataforma de gestão de horas "
                  "de extensão com certificação verificável por QR Code",
                  E["capa_sub"]),
        Spacer(1, 3 * cm),
        Paragraph(nota, E["nota_rosto"]),
        Spacer(1, 5 * cm),
        Paragraph("FORTALEZA — CE", E["capa_inst"]),
        Paragraph("2026", E["capa_inst"]),
        PageBreak(),
    ]


def sumario():
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("t1", fontName=FB, fontSize=12, leading=20, leftIndent=0),
        ParagraphStyle("t2", fontName=F, fontSize=12, leading=18, leftIndent=1 * cm),
        ParagraphStyle("t3", fontName=F, fontSize=12, leading=18, leftIndent=2 * cm),
    ]
    return [
        Paragraph("SUMÁRIO", ParagraphStyle("sum", fontName=FB, fontSize=12,
                                            alignment=TA_CENTER, spaceAfter=24)),
        toc,
        PageBreak(),
        NextPageTemplate("corpo"),
    ]


# ===================== 1 Introdução =====================

def introducao():
    return [
        h1("1", "Introdução"),
        h2("1.1", "Contextualização"),
        p("As atividades de extensão universitária integram o currículo dos cursos "
          "de graduação brasileiros e exigem que o estudante cumpra uma carga horária "
          "mínima em ações junto à comunidade. Essa exigência aproxima a formação "
          "acadêmica da realidade social e, ao mesmo tempo, atende organizações do "
          "terceiro setor que dependem de trabalho voluntário para executar suas ações."),
        p("Apesar da obrigatoriedade, o encontro entre esses dois lados permanece "
          "informal. O estudante descobre oportunidades por indicação pessoal, grupos "
          "de mensagem ou cartazes; a organização divulga suas ações pelos mesmos meios "
          "e administra a lista de voluntários em planilhas ou no papel."),

        h2("1.2", "Problema"),
        p("A dificuldade central não está em divulgar oportunidades, e sim em "
          "<b>comprovar que a hora de extensão realmente aconteceu</b>. O modelo "
          "predominante de comprovação é a declaração impressa ou em arquivo PDF, "
          "assinada pela organização e entregue pelo estudante à coordenação do curso."),
        p("Esse modelo apresenta uma fragilidade estrutural: o documento é o único "
          "objeto de prova, e documentos digitais são facilmente editáveis. A "
          "coordenação que recebe a declaração não dispõe de mecanismo prático para "
          "confirmar sua autenticidade — verificar caso a caso, por contato direto com "
          "cada organização, é inviável em escala."),
        p("Somam-se a isso duas lacunas: não há registro confiável da presença do "
          "estudante no dia da atividade, e não há canal padronizado entre estudantes "
          "e organizações."),

        h2("1.3", "Justificativa"),
        p("Este trabalho propõe uma plataforma que centraliza a oferta de atividades "
          "de extensão e, principalmente, torna a comprovação de horas <b>verificável "
          "de forma independente do documento entregue</b>."),
        p("A relevância da proposta está em tratar a comprovação como problema de "
          "integridade da informação, e não apenas como emissão de documento. Ao "
          "vincular o certificado a um registro consultável publicamente e protegido "
          "por assinatura digital, a verificação deixa de depender da confiança no "
          "arquivo e passa a depender de uma consulta à fonte."),
        PageBreak(),
    ]


# ===================== 2 Objetivos =====================

def objetivos():
    especificos = [
        "Mapear os requisitos funcionais e não funcionais da plataforma a partir "
        "das necessidades dos três públicos envolvidos;",
        "Modelar os processos de publicação de atividades, inscrição, registro de "
        "presença e emissão de certificados;",
        "Especificar mecanismo de registro de presença resistente a fraude, baseado "
        "em código QR de validade temporária;",
        "Especificar mecanismo de verificação pública de certificados, apoiado em "
        "assinatura digital e conferível por ferramenta independente da plataforma;",
        "Especificar a entrada por contas Google, Microsoft e GitHub sem enfraquecer "
        "o controle de acesso;",
        "Definir o modelo de dados e o contrato da interface de programação que "
        "sustentam os processos especificados;",
        "Estabelecer os controles de segurança, autenticação e auditoria "
        "necessários à operação da plataforma.",
    ]
    itens = [h1("2", "Objetivos"), h2("2.1", "Objetivo geral"),
             p("Especificar os requisitos de uma plataforma web que conecte estudantes "
               "de graduação a organizações da sociedade civil para a realização de "
               "atividades de extensão, emitindo certificados cuja autenticidade possa "
               "ser verificada publicamente por qualquer interessado.")]
    itens.append(h2("2.2", "Objetivos específicos"))
    for i, s in enumerate(especificos, 1):
        itens.append(Paragraph(f"{chr(96+i)}) {s}", E["corpo"]))
    return itens


# ===================== 3 Metodologia =====================

def metodologia():
    return [
        h1("3", "Metodologia"),
        p("A elaboração deste documento seguiu quatro etapas. Na primeira, foi feito "
          "o levantamento do problema junto aos públicos envolvidos, identificando as "
          "dores de estudantes, organizações e coordenações de curso."),
        p("Na segunda etapa, definiram-se os atores do sistema e seus objetivos, "
          "seguidos da modelagem dos estados de cada entidade do domínio. Optou-se por "
          "modelar primeiro as máquinas de estado, uma vez que as ações disponíveis em "
          "cada tela derivam diretamente do estado em que o objeto se encontra."),
        p("A terceira etapa consistiu na especificação dos requisitos funcionais e não "
          "funcionais, das regras de negócio e dos fluxos de uso — contemplando não "
          "apenas o caminho principal, mas também variações válidas e situações de erro."),
        p("Por fim, a quarta etapa traduziu a especificação em modelo de dados e "
          "contrato de interface de programação, artefatos que orientaram diretamente "
          "a implementação."),
        p("A construção ocorreu por fatias verticais, cada uma entregando interface, "
          "serviço e testes de uma parte utilizável do sistema. Os requisitos surgidos "
          "nesse percurso foram incorporados a esta versão do documento: a entrada por "
          "provedores externos, a prova pública da assinatura dos certificados, os "
          "painéis de entrada, o portal institucional e a publicação contínua em "
          "servidor próprio."),
    ]


# ===================== 4 Escopo =====================

def escopo():
    incluido = [
        ["Módulo", "Funcionalidades contempladas"],
        ["Portal público", "Apresentação da plataforma, listagem de atividades abertas, "
                           "organizações parceiras, verificação pública de certificados "
                           "e prova da assinatura"],
        ["Contas e acesso", "Cadastro, autenticação por senha ou por conta Google, "
                            "Microsoft e GitHub, recuperação de senha e manutenção "
                            "de perfil"],
        ["Atividades", "Criação em rascunho, publicação, edição, cancelamento e "
                       "encerramento"],
        ["Inscrições", "Inscrição automática ou mediante aprovação, cancelamento pelo "
                       "estudante e controle de vagas"],
        ["Presença", "Registro por leitura de código QR rotativo e confirmação pela "
                     "organização"],
        ["Certificação", "Emissão assinada digitalmente, verificação pública e revogação"],
        ["Painéis e avisos", "Painel de entrada com a próxima ação pendente e "
                             "notificações dentro do sistema"],
        ["Administração", "Console operacional, visualização como usuário em modo "
                          "somente leitura e auditoria de todas as ações do sistema"],
    ]
    excluido = [
        ["Item", "Justificativa"],
        ["Perfil institucional para coordenações",
         "A verificação pública dispensa cadastro da instituição, mantendo o sistema "
         "utilizável por qualquer faculdade sem acordo prévio"],
        ["Aplicativo móvel nativo",
         "A interface responsiva atende ao acesso por telefone, principal meio de uso "
         "previsto para estudantes"],
        ["Transações financeiras",
         "A plataforma não intermedeia pagamento, doação ou qualquer valor"],
        ["Avaliação mútua entre participantes",
         "Não é essencial ao problema de comprovação de horas"],
        ["Entrada por gov.br, Apple e LinkedIn",
         "O gov.br concede credencial apenas a órgão público; a Apple exige "
         "assinatura anual paga; o LinkedIn exige página de empresa para registrar "
         "o aplicativo"],
        ["Assinatura no padrão ICP-Brasil",
         "Exigiria certificado digital pago em nome da instituição; a assinatura "
         "Ed25519 própria já permite a conferência pública e independente"],
    ]
    itens = [h1("4", "Escopo do sistema"), h2("4.1", "Escopo incluído")]
    itens += quadro("Módulos contemplados pela primeira versão", incluido,
                    [4.2 * cm, L - 4.2 * cm])
    itens.append(h2("4.2", "Escopo excluído"))
    itens += quadro("Itens deliberadamente fora do escopo", excluido,
                    [5.5 * cm, L - 5.5 * cm])
    return itens


# ===================== 5 Atores =====================

def atores():
    dados = [
        ["Ator", "Autenticação", "Objetivo no sistema"],
        ["Visitante", "Não requer",
         "Conhecer a plataforma, as vagas abertas e as organizações parceiras, e "
         "criar conta"],
        ["Estudante", "Requer",
         "Encontrar atividades, participar e comprovar suas horas de extensão"],
        ["Organização", "Requer",
         "Divulgar ações, gerir voluntários e reconhecer a participação"],
        ["Verificador", "Não requer",
         "Confirmar a autenticidade de um certificado apresentado"],
        ["Administrador", "Requer",
         "Operar, auditar e destravar o sistema"],
        ["Provedor de identidade", "Sistema externo",
         "Confirmar a identidade e o e-mail de quem entra com conta Google, "
         "Microsoft ou GitHub"],
    ]
    itens = [h1("5", "Atores do sistema")]
    itens.append(p("O sistema reconhece seis atores. Três possuem conta autenticada, "
                   "dois atuam sem cadastro e um é sistema externo. O "
                   "<b>verificador</b> merece destaque: embora não possua cadastro, "
                   "é o ator que justifica a existência da plataforma, pois é para "
                   "ele que a verificação pública de certificados foi projetada."))
    itens += quadro("Atores e seus objetivos", dados,
                    [3.2 * cm, 2.8 * cm, L - 6 * cm])
    itens.append(p("O <b>administrador</b> é operador da plataforma, e não usuário do "
                   "domínio: não se inscreve em atividades nem publica vagas. Sua conta "
                   "não pode ser criada pelo formulário público de cadastro nem pela "
                   "entrada externa, sendo gerada exclusivamente por comando executado "
                   "no servidor ou por outro administrador já existente."))
    itens.append(p("O <b>provedor de identidade</b> é ator secundário. Google, "
                   "Microsoft e GitHub autenticam a pessoa em seus próprios sites e "
                   "informam à plataforma um identificador estável e o e-mail "
                   "verificado. A senha digitada no provedor nunca chega ao sistema."))
    itens += figura(dg.casos_de_uso(), "Diagrama de casos de uso")
    itens.append(PageBreak())
    return itens


# ===================== 6 Requisitos funcionais =====================

# Numerados na montagem do quadro: inserir um requisito no módulo certo não
# obriga a renumerar os seguintes à mão.
RF = [
    ("Cadastro", "Permitir a criação de conta de estudante ou de organização, "
     "com nome, e-mail e senha", "Alta"),
    ("Autenticação", "Permitir o acesso mediante e-mail e senha, "
     "direcionando o usuário conforme seu perfil", "Alta"),
    ("Entrada externa", "Permitir a entrada e o cadastro com conta Google, "
     "Microsoft ou GitHub, sem que a senha do provedor passe pela plataforma", "Alta"),
    ("Entrada externa", "Solicitar a quem entra pela primeira vez por provedor "
     "externo a escolha entre estudante e organização antes de criar a conta", "Alta"),
    ("Vínculo", "Reunir na mesma conta as entradas por senha e por provedores "
     "diferentes que comprovem o mesmo e-mail", "Média"),
    ("Sessão", "Manter a sessão ativa entre acessos e renová-la "
     "automaticamente, sem interromper a navegação", "Alta"),
    ("Senha", "Permitir a recuperação de senha esquecida por meio de "
     "vínculo enviado ao e-mail cadastrado", "Alta"),
    ("Perfil", "Permitir o preenchimento e a atualização dos dados de "
     "perfil, incluindo fotografia", "Média"),
    ("Perfil", "Exibir selo de vínculo institucional quando o provedor externo "
     "comprovar domínio da instituição de ensino", "Baixa"),
    ("Atividade", "Permitir que a organização crie atividades em rascunho "
     "e as publique quando concluídas", "Alta"),
    ("Atividade", "Permitir a edição e o cancelamento de atividades pela "
     "organização responsável", "Alta"),
    ("Vitrine", "Exibir publicamente as atividades disponíveis, com busca "
     "por título, local e organização", "Alta"),
    ("Portal", "Exibir publicamente as organizações parceiras e indicadores da "
     "plataforma calculados a partir da base", "Média"),
    ("Inscrição", "Permitir que o estudante se inscreva em atividades "
     "com vagas disponíveis", "Alta"),
    ("Inscrição", "Permitir que a organização exija aprovação prévia das "
     "inscrições, decidindo individualmente ou em lote", "Alta"),
    ("Inscrição", "Permitir que o estudante cancele sua inscrição até o "
     "início da atividade", "Média"),
    ("Presença", "Gerar código QR de validade temporária durante a "
     "atividade, para registro de presença", "Alta"),
    ("Presença", "Permitir que o estudante registre presença pela leitura "
     "do código QR exibido pela organização ou pela digitação do código", "Alta"),
    ("Presença", "Permitir o registro manual de presença para estudantes "
     "sem acesso a dispositivo móvel", "Alta"),
    ("Presença", "Permitir que a organização confirme ou ajuste as "
     "presenças antes de encerrar a atividade", "Alta"),
    ("Certificado", "Emitir certificado assinado digitalmente para cada "
     "presença confirmada, ao encerrar a atividade", "Alta"),
    ("Certificado", "Permitir ao estudante consultar e obter seus "
     "certificados em formato PDF com código QR", "Alta"),
    ("Verificação", "Permitir que qualquer pessoa, sem autenticação, "
     "verifique a autenticidade de um certificado", "Alta"),
    ("Verificação", "Publicar o texto assinado, a assinatura e a chave pública de "
     "cada certificado, para conferência sem depender da plataforma", "Alta"),
    ("Notificação", "Notificar o usuário, dentro do sistema, sobre "
     "aprovações, cancelamentos e emissões", "Média"),
    ("Painel", "Apresentar ao estudante o total de horas validadas, "
     "certificados e inscrições em andamento", "Média"),
    ("Painel", "Apresentar à organização os números de suas atividades e destacar, "
     "nos dois painéis, a próxima ação pendente", "Média"),
    ("Administração", "Disponibilizar console administrativo para gestão "
     "de contas, atividades e certificados", "Alta"),
    ("Administração", "Permitir ao administrador visualizar a plataforma como "
     "determinado usuário, em modo somente leitura", "Alta"),
    ("Auditoria", "Registrar todas as ações relevantes executadas no "
     "sistema, em trilha somente de inserção", "Alta"),
]


def requisitos_funcionais():
    dados = [["Código", "Módulo", "Descrição", "Prior."]]
    dados += [[f"RF-{i:02d}", m, d, pr] for i, (m, d, pr) in enumerate(RF, 1)]
    itens = [h1("6", "Requisitos funcionais")]
    itens.append(p("Os requisitos funcionais descrevem o que o sistema deve fazer. "
                   "A coluna de prioridade indica a criticidade do requisito para a "
                   "primeira versão da plataforma."))
    itens += quadro("Requisitos funcionais do sistema", dados,
                    [1.9 * cm, 2.4 * cm, L - 6.1 * cm, 1.8 * cm])
    itens.append(PageBreak())
    return itens


# ===================== 7 Requisitos não funcionais =====================

RNF = [
    ("Usabilidade", "A interface deve ser utilizável em telas a partir de "
     "375 pixels de largura, atendendo ao acesso por telefone celular"),
    ("Usabilidade", "Toda a interface e as mensagens de erro devem estar "
     "em língua portuguesa"),
    ("Usabilidade", "O registro de presença não deve aguardar indefinidamente a "
     "localização: sem resposta em quatro segundos, o envio prossegue sem ela"),
    ("Segurança", "As senhas devem ser armazenadas por meio de função de "
     "derivação de chave resistente (Argon2id), nunca em texto legível"),
    ("Segurança", "O token de acesso não deve ser persistido no navegador, "
     "permanecendo apenas em memória"),
    ("Segurança", "O token de renovação deve trafegar exclusivamente em "
     "cookie inacessível a scripts e ser armazenado apenas como resumo criptográfico"),
    ("Segurança", "Deve ser possível revogar qualquer sessão ativa a "
     "partir do servidor"),
    ("Segurança", "A autenticidade do certificado deve ser verificável por "
     "assinatura digital, independentemente do arquivo apresentado"),
    ("Segurança", "Tentativas de autenticação devem ser limitadas por "
     "origem, mitigando ataques de força bruta"),
    ("Segurança", "A entrada externa deve usar o fluxo de código de autorização com "
     "PKCE e parâmetro de estado, sem expor credencial na URL"),
    ("Segurança", "Credenciais dos provedores e chave privada de assinatura devem "
     "residir apenas na configuração do servidor, fora do código e do banco"),
    ("Segurança", "Toda comunicação deve ocorrer sob HTTPS, com certificado "
     "renovado automaticamente"),
    ("Integridade", "As restrições de unicidade e integridade referencial "
     "devem ser garantidas pelo banco de dados, e não apenas pela aplicação"),
    ("Auditabilidade", "A trilha de auditoria deve ser somente de inserção, "
     "sem caminho de alteração ou exclusão para qualquer perfil"),
    ("Manutenibilidade", "O sistema deve manter separação entre camadas de "
     "apresentação, regra de negócio e acesso a dados"),
    ("Confiabilidade", "Nova versão só deve ser publicada após aprovação dos testes "
     "automatizados e da aplicação e reversão das migrações de banco"),
    ("Disponibilidade", "A verificação pública de certificados não deve "
     "depender de autenticação nem de sessão ativa"),
]


def requisitos_nao_funcionais():
    dados = [["Código", "Categoria", "Descrição"]]
    dados += [[f"RNF-{i:02d}", cat, d] for i, (cat, d) in enumerate(RNF, 1)]
    itens = [h1("7", "Requisitos não funcionais")]
    itens.append(p("Os requisitos não funcionais estabelecem restrições de qualidade, "
                   "segurança e desempenho que o sistema deve observar."))
    itens += quadro("Requisitos não funcionais do sistema", dados,
                    [2.1 * cm, 3.1 * cm, L - 5.2 * cm])
    itens.append(PageBreak())
    return itens


# ===================== 8 Regras de negócio =====================

# Aqui a numeração é fixa: os casos de uso citam regras pelo código, então
# regra nova entra no fim.
RN = [
    ("RN-01", "Um estudante não pode possuir mais de uma inscrição ativa na mesma "
     "atividade"),
    ("RN-02", "Cada inscrição gera, no máximo, um certificado"),
    ("RN-03", "A atividade não pode ser encerrada enquanto houver participante sem "
     "decisão de presença"),
    ("RN-04", "Somente a presença confirmada gera certificado"),
    ("RN-05", "A data da atividade não pode ser anterior à data corrente"),
    ("RN-06", "O horário de término deve ser posterior ao de início"),
    ("RN-07", "A carga horária é sugerida pela duração do evento e deve ser maior "
     "que zero"),
    ("RN-08", "O número máximo de vagas não pode ser inferior ao mínimo, nem ao "
     "total de inscritos"),
    ("RN-09", "Não é permitida inscrição em atividade com vagas esgotadas ou já "
     "iniciada"),
    ("RN-10", "Somente a organização criadora pode editar, encerrar ou cancelar a "
     "atividade"),
    ("RN-11", "Havendo inscritos, apenas os limites de vagas podem ser alterados"),
    ("RN-12", "O estudante pode cancelar sua inscrição até o início da atividade, "
     "liberando a vaga"),
    ("RN-13", "O estudante deve possuir nome completo, instituição e curso "
     "preenchidos antes da primeira inscrição"),
    ("RN-14", "Cada estudante pode manter no máximo cinco inscrições ativas "
     "simultâneas"),
    ("RN-15", "O registro de presença por código QR só é aceito durante a realização "
     "da atividade"),
    ("RN-16", "O código QR de presença é renovado a cada trinta segundos e aceito "
     "por, no máximo, quarenta"),
    ("RN-17", "O registro de presença constitui evidência; a decisão final cabe à "
     "organização"),
    ("RN-18", "Todo certificado é assinado digitalmente no momento da emissão"),
    ("RN-19", "O certificado pode ser revogado, mediante justificativa, sem ser "
     "excluído do sistema"),
    ("RN-20", "Somente atividades em rascunho podem ser excluídas definitivamente"),
    ("RN-21", "O estudante visualiza apenas a quantidade de inscritos, nunca a "
     "identificação dos demais participantes"),
    ("RN-22", "A autenticação não deve revelar se um endereço de e-mail está "
     "cadastrado"),
    ("RN-23", "O administrador não define nem visualiza senhas; apenas dispara a "
     "redefinição"),
    ("RN-24", "O acesso administrativo à conta de terceiro é somente de leitura e "
     "integralmente registrado"),
    ("RN-25", "O administrador pode revogar certificados, mas nunca emiti-los"),
    ("RN-26", "A suspensão de conta preserva o histórico, os certificados emitidos e "
     "a trilha de auditoria"),
    ("RN-27", "A identidade externa é reconhecida pelo par provedor e identificador "
     "estável; o e-mail nunca é chave de acesso"),
    ("RN-28", "A entrada externa só é aceita com e-mail verificado pelo provedor"),
    ("RN-29", "Na Microsoft, o e-mail de conta institucional só é aceito quando o "
     "provedor atesta sua verificação; sem a atestação, a entrada é recusada"),
    ("RN-30", "Entrada externa com e-mail já cadastrado vincula-se à conta "
     "existente, sem criar outra"),
    ("RN-31", "A conta nova por entrada externa só é criada após a escolha do "
     "perfil; o cadastro pendente expira em quinze minutos"),
    ("RN-32", "A conta criada por entrada externa não possui senha; a tentativa de "
     "acesso por senha recebe a resposta genérica de credencial inválida"),
    ("RN-33", "O selo de vínculo institucional decorre de domínio comprovado pelo "
     "provedor, nunca de declaração do usuário"),
    ("RN-34", "Provedor sem credencial configurada não é oferecido na interface"),
    ("RN-35", "Certificado revogado mantém a assinatura válida; a verificação "
     "informa a revogação separadamente da autenticidade"),
    ("RN-36", "Indicadores públicos são calculados a partir da base, e valor zero "
     "não é exibido"),
    ("RN-37", "A organização só figura entre as parceiras depois de publicar ao "
     "menos uma atividade"),
    ("RN-38", "O destaque do painel segue prioridade definida pelo servidor, e o "
     "evento do dia deixa de ser destacado quando termina"),
    ("RN-39", "Na visualização como outro usuário, o código QR de presença não é "
     "exibido, por constituir credencial"),
]


def regras_negocio():
    dados = [["Código", "Regra"]] + [[c, d] for c, d in RN]
    itens = [h1("8", "Regras de negócio")]
    itens.append(p("As regras de negócio expressam restrições do domínio que o "
                   "sistema deve fazer valer, independentemente da interface "
                   "utilizada."))
    itens += quadro("Regras de negócio do sistema", dados, [2.1 * cm, L - 2.1 * cm])
    itens.append(PageBreak())
    return itens
