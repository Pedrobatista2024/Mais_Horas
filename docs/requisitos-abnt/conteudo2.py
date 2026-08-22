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
         "A2. Sem dispositivo móvel, a organização registra a presença por ele (RN-17)"],
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
         "do documento recebido"],
        ["E1. Código inexistente: informa que nenhum certificado corresponde",
         "E2. Certificado revogado: apresenta os dados com a devida advertência",
         "E3. Assinatura divergente: alerta de adulteração do registro"],
        "Autenticidade confirmada ou recusada, sem necessidade de contato com a "
        "organização emissora")
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
    ]
    itens += quadro("Fluxos alternativos e de exceção", dados,
                    [5.2 * cm, L - 5.2 * cm])
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
                   "responsáveis por sessão, redefinição de senha, notificação e "
                   "auditoria.", "corpo"))
    itens += figura(dg.der_apoio(), "Entidades de apoio ao sistema")
    itens.append(p("A tabela de auditoria não mantém chave estrangeira para a tabela "
                   "de usuários. A decisão é deliberada: caso a conta investigada "
                   "fosse removida, uma exclusão em cascata eliminaria justamente o "
                   "registro necessário à investigação."))

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
         "parceiras, Verificação de certificado, Acesso e Cadastro"],
        ["Área do estudante", "Estudante",
         "Painel, Vitrine de atividades, Detalhe da atividade, Minhas inscrições, "
         "Registro de presença, Meus certificados e Perfil"],
        ["Painel da organização", "Organização",
         "Painel, Minhas atividades, Criação e edição, Gestão da atividade, "
         "Inscrições, Painel de presença e Validação"],
        ["Console administrativo", "Administrador",
         "Visão geral, Auditoria, Contas, Organizações, Atividades, Certificados e "
         "Parâmetros do sistema"],
    ]
    itens += quadro("Áreas de navegação e telas previstas", dados,
                    [3.6 * cm, 3.4 * cm, L - 7 * cm])
    itens.append(p("O acesso é único para todos os perfis: o destino após a "
                   "autenticação decorre do papel do usuário. Não há endereço "
                   "específico de acesso administrativo, opção que evita sinalizar a "
                   "existência de área privilegiada a eventual atacante."))
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
    ]
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
    return itens


# ===================== 15 Segurança =====================

def seguranca():
    itens = [h1("15", "Segurança e desafio tecnológico")]
    itens.append(p("O desafio tecnológico central deste projeto consiste em garantir "
                   "que a hora de extensão comprovada seja verdadeira. Três camadas "
                   "complementares tratam do problema."))

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
    dados = [
        ["Camada", "Ameaça tratada", "Mecanismo"],
        ["Verificação pública", "Edição do arquivo PDF entregue",
         "Consulta do código à base de dados"],
        ["Código QR rotativo", "Registro de presença por quem não compareceu",
         "Código derivado de janela temporal de trinta segundos"],
        ["Assinatura digital", "Inserção fraudulenta no banco de dados",
         "Assinatura Ed25519 com chave mantida fora do banco"],
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
    itens.append(p("Foram especificados vinte e dois requisitos funcionais, doze "
                   "requisitos não funcionais e vinte e seis regras de negócio, além "
                   "do modelo de dados com dez entidades e do detalhamento das "
                   "interfaces previstas. A modelagem priorizou a declaração de "
                   "restrições no próprio banco de dados sempre que possível, "
                   "reduzindo a dependência de verificações na aplicação."))
    itens.append(p("Como continuidade, prevê-se a implementação da plataforma conforme "
                   "esta especificação, seguida de piloto com organizações parceiras. "
                   "Entre as evoluções mapeadas estão a notificação por correio "
                   "eletrônico, a exportação de relatórios para as coordenações e a "
                   "verificação de certificados sem conexão com a internet."))
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
        "PRESSMAN, R. S.; MAXIM, B. R. <b>Engenharia de software</b>: uma abordagem "
        "profissional. 8. ed. Porto Alegre: AMGH, 2016.",
        "SOMMERVILLE, I. <b>Engenharia de software</b>. 10. ed. São Paulo: Pearson, 2018.",
    ]
    itens = [Paragraph("REFERÊNCIAS", E["h1"])]
    for r in sorted(refs):
        itens.append(Paragraph(r, E["ref"]))
    return itens
