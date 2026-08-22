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
        "assinatura digital;",
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
          "contrato de interface de programação, artefatos que orientarão diretamente "
          "a implementação."),
    ]


# ===================== 4 Escopo =====================

def escopo():
    incluido = [
        ["Módulo", "Funcionalidades contempladas"],
        ["Portal público", "Apresentação da plataforma, listagem de atividades abertas "
                           "e verificação pública de certificados"],
        ["Contas e acesso", "Cadastro, autenticação, recuperação de senha e manutenção "
                            "de perfil"],
        ["Atividades", "Criação em rascunho, publicação, edição, cancelamento e "
                       "encerramento"],
        ["Inscrições", "Inscrição automática ou mediante aprovação, cancelamento pelo "
                       "estudante e controle de vagas"],
        ["Presença", "Registro por leitura de código QR rotativo e confirmação pela "
                     "organização"],
        ["Certificação", "Emissão assinada digitalmente, verificação pública e revogação"],
        ["Administração", "Console operacional com auditoria de todas as ações do sistema"],
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
         "Conhecer a plataforma e criar conta"],
        ["Estudante", "Requer",
         "Encontrar atividades, participar e comprovar suas horas de extensão"],
        ["Organização", "Requer",
         "Divulgar ações, gerir voluntários e reconhecer a participação"],
        ["Verificador", "Não requer",
         "Confirmar a autenticidade de um certificado apresentado"],
        ["Administrador", "Requer",
         "Operar, auditar e destravar o sistema"],
    ]
    itens = [h1("5", "Atores do sistema")]
    itens.append(p("O sistema reconhece cinco atores, dos quais três possuem conta "
                   "autenticada. O <b>verificador</b> merece destaque: embora não "
                   "possua cadastro, é o ator que justifica a existência da "
                   "plataforma, pois é para ele que a verificação pública de "
                   "certificados foi projetada."))
    itens += quadro("Atores e seus objetivos", dados,
                    [3.2 * cm, 2.8 * cm, L - 6 * cm])
    itens.append(p("O <b>administrador</b> é operador da plataforma, e não usuário do "
                   "domínio: não se inscreve em atividades nem publica vagas. Sua conta "
                   "não pode ser criada pelo formulário público de cadastro, sendo "
                   "gerada exclusivamente por comando executado no servidor ou por "
                   "outro administrador já existente."))
    itens.append(PageBreak())
    itens += figura(dg.casos_de_uso(), "Diagrama de casos de uso")
    itens.append(PageBreak())
    return itens


# ===================== 6 Requisitos funcionais =====================

RF = [
    ("RF-01", "Cadastro", "Permitir a criação de conta de estudante ou de organização, "
     "com nome, e-mail e senha", "Alta"),
    ("RF-02", "Autenticação", "Permitir o acesso mediante e-mail e senha, "
     "direcionando o usuário conforme seu perfil", "Alta"),
    ("RF-03", "Sessão", "Manter a sessão ativa entre acessos e renová-la "
     "automaticamente, sem interromper a navegação", "Alta"),
    ("RF-04", "Senha", "Permitir a recuperação de senha esquecida por meio de "
     "vínculo enviado ao e-mail cadastrado", "Alta"),
    ("RF-05", "Perfil", "Permitir o preenchimento e a atualização dos dados de "
     "perfil, incluindo fotografia", "Média"),
    ("RF-06", "Atividade", "Permitir que a organização crie atividades em rascunho "
     "e as publique quando concluídas", "Alta"),
    ("RF-07", "Atividade", "Permitir a edição e o cancelamento de atividades pela "
     "organização responsável", "Alta"),
    ("RF-08", "Vitrine", "Exibir publicamente as atividades disponíveis, com busca "
     "por título, local e organização", "Alta"),
    ("RF-09", "Inscrição", "Permitir que o estudante se inscreva em atividades "
     "com vagas disponíveis", "Alta"),
    ("RF-10", "Inscrição", "Permitir que a organização exija aprovação prévia das "
     "inscrições, decidindo individualmente", "Alta"),
    ("RF-11", "Inscrição", "Permitir que o estudante cancele sua inscrição até o "
     "início da atividade", "Média"),
    ("RF-12", "Presença", "Gerar código QR de validade temporária durante a "
     "atividade, para registro de presença", "Alta"),
    ("RF-13", "Presença", "Permitir que o estudante registre presença pela leitura "
     "do código QR exibido pela organização", "Alta"),
    ("RF-14", "Presença", "Permitir o registro manual de presença para estudantes "
     "sem acesso a dispositivo móvel", "Alta"),
    ("RF-15", "Presença", "Permitir que a organização confirme ou ajuste as "
     "presenças antes de encerrar a atividade", "Alta"),
    ("RF-16", "Certificado", "Emitir certificado assinado digitalmente para cada "
     "presença confirmada, ao encerrar a atividade", "Alta"),
    ("RF-17", "Certificado", "Permitir ao estudante consultar e obter seus "
     "certificados em formato PDF com código QR", "Alta"),
    ("RF-18", "Verificação", "Permitir que qualquer pessoa, sem autenticação, "
     "verifique a autenticidade de um certificado", "Alta"),
    ("RF-19", "Notificação", "Notificar o usuário, dentro do sistema, sobre "
     "aprovações, cancelamentos e emissões", "Média"),
    ("RF-20", "Painel", "Apresentar ao estudante o total de horas validadas, "
     "certificados e inscrições em andamento", "Média"),
    ("RF-21", "Administração", "Disponibilizar console administrativo para gestão "
     "de contas, atividades e certificados", "Alta"),
    ("RF-22", "Auditoria", "Registrar todas as ações relevantes executadas no "
     "sistema, em trilha somente de inserção", "Alta"),
]


def requisitos_funcionais():
    dados = [["Código", "Módulo", "Descrição", "Prior."]]
    dados += [[c, m, d, pr] for c, m, d, pr in RF]
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
    ("RNF-01", "Usabilidade", "A interface deve ser utilizável em telas a partir de "
     "375 pixels de largura, atendendo ao acesso por telefone celular"),
    ("RNF-02", "Usabilidade", "Toda a interface e as mensagens de erro devem estar "
     "em língua portuguesa"),
    ("RNF-03", "Segurança", "As senhas devem ser armazenadas por meio de função de "
     "derivação de chave resistente (Argon2id), nunca em texto legível"),
    ("RNF-04", "Segurança", "O token de acesso não deve ser persistido no navegador, "
     "permanecendo apenas em memória"),
    ("RNF-05", "Segurança", "O token de renovação deve trafegar exclusivamente em "
     "cookie inacessível a scripts e ser armazenado apenas como resumo criptográfico"),
    ("RNF-06", "Segurança", "Deve ser possível revogar qualquer sessão ativa a "
     "partir do servidor"),
    ("RNF-07", "Segurança", "A autenticidade do certificado deve ser verificável por "
     "assinatura digital, independentemente do arquivo apresentado"),
    ("RNF-08", "Segurança", "Tentativas de autenticação devem ser limitadas por "
     "origem, mitigando ataques de força bruta"),
    ("RNF-09", "Integridade", "As restrições de unicidade e integridade referencial "
     "devem ser garantidas pelo banco de dados, e não apenas pela aplicação"),
    ("RNF-10", "Auditabilidade", "A trilha de auditoria deve ser somente de inserção, "
     "sem caminho de alteração ou exclusão para qualquer perfil"),
    ("RNF-11", "Manutenibilidade", "O sistema deve manter separação entre camadas de "
     "apresentação, regra de negócio e acesso a dados"),
    ("RNF-12", "Disponibilidade", "A verificação pública de certificados não deve "
     "depender de autenticação nem de sessão ativa"),
]


def requisitos_nao_funcionais():
    dados = [["Código", "Categoria", "Descrição"]]
    dados += [[c, cat, d] for c, cat, d in RNF]
    itens = [h1("7", "Requisitos não funcionais")]
    itens.append(p("Os requisitos não funcionais estabelecem restrições de qualidade, "
                   "segurança e desempenho que o sistema deve observar."))
    itens += quadro("Requisitos não funcionais do sistema", dados,
                    [2.1 * cm, 3.1 * cm, L - 5.2 * cm])
    itens.append(PageBreak())
    return itens


# ===================== 8 Regras de negócio =====================

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
    ("RN-16", "Cada código QR de presença expira em aproximadamente trinta segundos"),
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
