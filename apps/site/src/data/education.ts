export type EducationBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type EducationCategory =
  | "Respiratoria"
  | "Piel"
  | "Alimentaria"
  | "Emergencia"
  | "Medicamentos"
  | "Ocular"
  | "Insectos";

export type EducationTopic = {
  slug: string;
  title: string;
  category: EducationCategory;
  summary: string;
  readingMinutes: number;
  body: EducationBlock[];
};

export const educationTopics: EducationTopic[] = [
  {
    slug: "rinitis-alergica",
    title: "Rinitis alérgica",
    category: "Respiratoria",
    summary:
      "Inflamación de la mucosa nasal frente a alérgenos del ambiente. Provoca estornudos, congestión y picor, y suele acompañarse de síntomas oculares.",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "La rinitis alérgica es una inflamación de la mucosa de la nariz que aparece cuando el sistema inmune reacciona de forma exagerada frente a sustancias del ambiente, llamadas alérgenos, que para la mayoría de las personas son inofensivas. Es una de las consultas más frecuentes en alergología y puede afectar de forma importante el descanso, la concentración y la calidad de vida.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Estornudos en salvas, sobre todo al levantarse o al exponerse al alérgeno.",
          "Congestión nasal y sensación de nariz tapada.",
          "Secreción nasal acuosa (rinorrea) y goteo hacia la garganta.",
          "Picor de nariz, paladar, ojos u oídos.",
          "Síntomas oculares asociados: ojos rojos, llorosos y con picor (conjuntivitis alérgica).",
        ],
      },
      { type: "h2", text: "Desencadenantes frecuentes" },
      {
        type: "p",
        text: "Según el caso, los síntomas pueden ser estacionales o presentarse durante todo el año. Los desencadenantes más comunes son los ácaros del polvo doméstico, los pólenes de pastos y árboles, los hongos del ambiente y los epitelios de mascotas. Identificar cuáles son relevantes para cada persona es parte del estudio alergológico.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "El manejo combina medidas para reducir la exposición al alérgeno, tratamiento de los síntomas y, en casos seleccionados, inmunoterapia (vacunas para la alergia) que busca modificar la respuesta del sistema inmune en el tiempo. Las medidas y los medicamentos específicos siempre se definen en la consulta médica, según la historia clínica y los resultados de los estudios.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Conviene consultar cuando los síntomas se repiten, interfieren con el sueño o las actividades diarias, no mejoran con medidas generales o se acompañan de tos, pitidos al respirar o ahogo, ya que la rinitis puede asociarse a asma. Un especialista puede orientar el diagnóstico y proponer un plan adecuado para tu caso.",
      },
    ],
  },
  {
    slug: "asma-alergica",
    title: "Asma alérgica",
    category: "Respiratoria",
    summary:
      "Enfermedad inflamatoria crónica de los bronquios que, en su forma alérgica, se desencadena por alérgenos del ambiente y cursa con tos, pitidos y dificultad para respirar.",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "El asma es una enfermedad crónica de las vías respiratorias en la que los bronquios se inflaman y se estrechan, dificultando el paso del aire. En el asma alérgica, las crisis se desencadenan o empeoran al entrar en contacto con alérgenos del ambiente. Es una condición frecuente que, bien controlada, permite llevar una vida plenamente normal.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Tos persistente, que suele empeorar de noche o con el ejercicio.",
          "Pitidos o silbidos al respirar (sibilancias).",
          "Sensación de ahogo o falta de aire.",
          "Opresión o presión en el pecho.",
          "Síntomas que aparecen o empeoran ante un desencadenante conocido.",
        ],
      },
      { type: "h2", text: "Desencadenantes frecuentes" },
      {
        type: "p",
        text: "Además de los alérgenos como ácaros, pólenes, hongos y epitelios de mascotas, las crisis pueden gatillarse por infecciones respiratorias, humo de tabaco, cambios bruscos de temperatura, contaminación o el ejercicio. La combinación de factores varía de una persona a otra.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "El asma se controla con un plan que combina tratamiento de mantención para reducir la inflamación, medicación de rescate para las crisis y medidas para evitar los desencadenantes. En personas con un componente alérgico bien definido, la inmunoterapia puede ser parte de la estrategia. El tipo de tratamiento, las dosis y el plan de acción ante una crisis se definen siempre en la consulta médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Es importante consultar si presentas tos o ahogo recurrentes, si necesitas usar con frecuencia el inhalador de rescate, si los síntomas te despiertan de noche o limitan tu actividad. Una crisis con dificultad respiratoria importante, dificultad para hablar o labios azulados es una urgencia: busca atención médica de inmediato.",
      },
    ],
  },
  {
    slug: "dermatitis-atopica",
    title: "Dermatitis atópica",
    category: "Piel",
    summary:
      "Enfermedad inflamatoria de la piel que cursa con sequedad, picor intenso y brotes de eccema. Es frecuente en la infancia y puede acompañar a otras condiciones alérgicas.",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "La dermatitis atópica es una enfermedad inflamatoria crónica de la piel que se caracteriza por sequedad y picor intenso, con brotes de lesiones de eccema. Es muy frecuente en la infancia, aunque también puede presentarse o persistir en adultos. Se asocia a una piel con una barrera más frágil y a una mayor tendencia a otras condiciones alérgicas, como rinitis o asma.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Piel seca y áspera de forma generalizada.",
          "Picor intenso, que suele empeorar de noche.",
          "Placas rojas, descamación y, en los brotes, lesiones que pueden supurar.",
          "Localización típica en pliegues de codos y rodillas, cuello y cara, según la edad.",
          "Engrosamiento de la piel en zonas que se rascan de forma repetida.",
        ],
      },
      { type: "h2", text: "Desencadenantes y causas" },
      {
        type: "p",
        text: "En su origen intervienen factores genéticos, una barrera cutánea alterada y la respuesta del sistema inmune. Los brotes pueden gatillarse por jabones irritantes, ropa de fibras ásperas, sudor, cambios de temperatura, estrés y, en algunos casos, ciertos alérgenos. Identificar los factores que empeoran cada caso ayuda a espaciar los brotes.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "La base del cuidado es la hidratación diaria y constante de la piel para reforzar su barrera, junto con el tratamiento de los brotes y la reducción de irritantes. Existen distintas opciones terapéuticas según la intensidad. El plan de cuidado y los medicamentos se definen en la consulta médica, de forma individual.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Conviene consultar cuando el picor o las lesiones afectan el sueño o la rutina, cuando los brotes son frecuentes o extensos, o cuando aparecen signos de infección en la piel, como costras amarillentas, dolor o aumento del enrojecimiento. Una evaluación especializada permite ordenar el cuidado y descartar factores asociados.",
      },
    ],
  },
  {
    slug: "alergia-alimentaria",
    title: "Alergia alimentaria",
    category: "Alimentaria",
    summary:
      "Reacción del sistema inmune frente a un alimento. Puede provocar síntomas en la piel, el aparato digestivo o la respiración, y en algunos casos reacciones graves.",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "La alergia alimentaria es una reacción del sistema inmune que se produce al ingerir, y a veces solo al tocar o inhalar, un alimento determinado. Es importante distinguirla de las intolerancias alimentarias, que no involucran al sistema inmune y suelen ser distintas en su mecanismo y manejo. El diagnóstico correcto evita restricciones innecesarias en la dieta.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "En la piel: ronchas (urticaria), enrojecimiento, picor o hinchazón de labios y párpados.",
          "En el aparato digestivo: dolor abdominal, vómitos o diarrea.",
          "En la respiración: congestión, estornudos, tos o dificultad para respirar.",
          "Los síntomas suelen aparecer minutos a un par de horas después de consumir el alimento.",
          "En casos graves, una reacción generalizada llamada anafilaxia, que es una urgencia médica.",
        ],
      },
      { type: "h2", text: "Alimentos y causas frecuentes" },
      {
        type: "p",
        text: "Los alimentos implicados varían según la edad y la región. Entre los más frecuentes están la leche, el huevo, los frutos secos, el maní, el pescado, los mariscos, la soya y el trigo. Algunas alergias de la infancia se superan con el tiempo, mientras que otras tienden a persistir.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "La base del manejo es identificar con precisión el alimento responsable y evitarlo, junto con un plan claro de qué hacer ante una reacción accidental. En personas con riesgo de reacciones graves, el equipo médico indica las medidas y la medicación de rescate correspondientes. El diagnóstico, el plan de evitación y el tratamiento se definen siempre en la consulta médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Conviene consultar ante cualquier reacción tras comer un alimento, sobre todo si fue intensa, se repitió o involucró la respiración. No es recomendable retirar alimentos importantes de la dieta sin un estudio que lo respalde. Si una reacción incluye dificultad para respirar, hinchazón de la garganta o mareo, busca atención de urgencia.",
      },
    ],
  },
  {
    slug: "urticaria",
    title: "Urticaria",
    category: "Piel",
    summary:
      "Aparición de ronchas (habones) en la piel con picor, que pueden ir y venir. A veces se asocia a hinchazón más profunda llamada angioedema.",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "La urticaria es una reacción de la piel que se manifiesta como ronchas o habones que pican, de bordes bien definidos y que suelen cambiar de lugar y desaparecer en horas para reaparecer en otra zona. Puede aparecer una sola vez (aguda) o repetirse durante semanas o meses (crónica). En ocasiones se acompaña de una hinchazón más profunda, llamada angioedema, que afecta párpados, labios o manos.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Ronchas elevadas y rojizas, de tamaño variable, con picor.",
          "Lesiones que aparecen y desaparecen, cambiando de ubicación.",
          "Hinchazón de labios, párpados o manos (angioedema) en algunos casos.",
          "Sensación de ardor o molestia en las zonas afectadas.",
        ],
      },
      { type: "h2", text: "Desencadenantes y causas" },
      {
        type: "p",
        text: "La urticaria puede desencadenarse por infecciones, ciertos alimentos o medicamentos, picaduras, o por estímulos físicos como el frío, la presión, el rascado o el ejercicio. En muchos casos de urticaria crónica no se identifica una causa externa única, y el cuadro responde a un mecanismo interno; aun así, su manejo es efectivo.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "El manejo se orienta a controlar el picor y las ronchas, identificar y evitar desencadenantes cuando existen, y dar seguimiento a los casos crónicos. Existen distintas opciones según la respuesta de cada persona. El tratamiento y la necesidad de estudios complementarios se definen en la consulta médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Es recomendable consultar cuando las ronchas se repiten, duran más de unas semanas o no se controlan con medidas generales. Acude a urgencias si la hinchazón compromete la lengua o la garganta, si hay dificultad para respirar o tragar, o si la urticaria se acompaña de mareo o sensación de desmayo.",
      },
    ],
  },
  {
    slug: "anafilaxia",
    title: "Anafilaxia: la urgencia alérgica",
    category: "Emergencia",
    summary:
      "Reacción alérgica grave y de rápida progresión que puede comprometer la vida. Es una urgencia médica: requiere adrenalina y atención inmediata.",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "La anafilaxia es la forma más grave de reacción alérgica. Se trata de una respuesta intensa y de rápida progresión que puede afectar varios órganos al mismo tiempo y comprometer la respiración y la circulación. Es una urgencia médica: reconocerla a tiempo y actuar de inmediato puede salvar vidas.",
      },
      { type: "h2", text: "Señales de alarma" },
      {
        type: "ul",
        items: [
          "Dificultad para respirar, pitidos, tos intensa o sensación de cierre de la garganta.",
          "Hinchazón de labios, lengua o garganta, o cambio en la voz.",
          "Ronchas generalizadas, picor extenso y enrojecimiento de la piel.",
          "Mareo, debilidad intensa, desmayo o sensación de pérdida de conciencia.",
          "Vómitos, dolor abdominal intenso o diarrea de aparición brusca.",
          "Síntomas que afectan dos o más sistemas del cuerpo poco después de la exposición.",
        ],
      },
      { type: "h2", text: "Qué hacer: es una emergencia" },
      {
        type: "p",
        text: "Ante una sospecha de anafilaxia, el tratamiento de primera línea es la adrenalina (epinefrina) administrada lo antes posible, y se debe acudir o llamar a urgencias de inmediato. La adrenalina se utiliza bajo indicación médica y, cuando se ha prescrito un autoinyector, debe usarse según las instrucciones recibidas. Los antihistamínicos no reemplazan a la adrenalina ni deben retrasar la atención de urgencia.",
      },
      {
        type: "p",
        text: "Mientras llega la ayuda, conviene mantener a la persona recostada con las piernas elevadas (salvo que tenga dificultad para respirar o vómitos), no dejarla sola y trasladarla a un centro asistencial aunque los síntomas parezcan mejorar, porque pueden reaparecer.",
      },
      { type: "h2", text: "Desencadenantes frecuentes" },
      {
        type: "p",
        text: "Los gatillantes más habituales son ciertos alimentos, medicamentos y picaduras de insectos como abejas y avispas. Conocer el desencadenante propio y portar un plan de acción son parte fundamental de la prevención.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Toda persona que haya tenido una reacción alérgica grave debe ser evaluada por un especialista para confirmar la causa, recibir un plan de acción y, cuando corresponda, la indicación de adrenalina autoinyectable, que requiere receta médica. La evaluación posterior es clave para prevenir nuevos episodios. Recuerda: ante una anafilaxia en curso, primero la urgencia.",
      },
    ],
  },
  {
    slug: "alergia-a-medicamentos",
    title: "Alergia a medicamentos",
    category: "Medicamentos",
    summary:
      "Reacción del sistema inmune frente a un fármaco. Es importante confirmarla con estudio, porque muchas reacciones atribuidas a medicamentos no son verdaderas alergias.",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "La alergia a medicamentos es una reacción del sistema inmune frente a un fármaco. No toda molestia tras tomar un medicamento es una alergia: muchos efectos son secundarios conocidos o reacciones no inmunológicas. Confirmar o descartar una alergia real es importante, porque etiquetar a alguien como alérgico sin estudio puede privarlo de tratamientos útiles y obligar a usar alternativas menos adecuadas.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Ronchas, picor o enrojecimiento de la piel.",
          "Hinchazón de labios, párpados o cara (angioedema).",
          "Síntomas respiratorios o digestivos.",
          "En casos graves, anafilaxia, que es una urgencia médica.",
          "El tiempo entre la toma y los síntomas ayuda a orientar el tipo de reacción.",
        ],
      },
      { type: "h2", text: "Fármacos frecuentemente implicados" },
      {
        type: "p",
        text: "Entre los más reportados están algunos antibióticos (como los betalactámicos), antiinflamatorios y, en contextos específicos, anestésicos o medios de contraste. Que un fármaco sea frecuente no significa que tú seas alérgico a él: solo el estudio dirigido lo confirma.",
      },
      { type: "h2", text: "Cómo se estudia y maneja" },
      {
        type: "p",
        text: "El estudio puede incluir la historia clínica detallada, pruebas cutáneas y, en casos seleccionados, pruebas de provocación controlada en un entorno preparado. El objetivo es confirmar el fármaco responsable, identificar alternativas seguras y, cuando corresponde, evaluar procedimientos de desensibilización. Todo se define y se realiza bajo supervisión médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Conviene consultar si tuviste una reacción tras un medicamento, si te han dicho que eres alérgico a un fármaco sin estudio, o si necesitas un tratamiento al que crees ser alérgico. Ante una reacción con dificultad para respirar o hinchazón de la garganta, busca atención de urgencia.",
      },
    ],
  },
  {
    slug: "conjuntivitis-alergica",
    title: "Conjuntivitis alérgica",
    category: "Ocular",
    summary:
      "Inflamación de la conjuntiva del ojo por contacto con alérgenos. Produce ojos rojos, llorosos y con picor, y suele acompañar a la rinitis alérgica.",
    readingMinutes: 4,
    body: [
      {
        type: "p",
        text: "La conjuntivitis alérgica es la inflamación de la conjuntiva, la membrana que recubre la superficie del ojo y el interior de los párpados, cuando entra en contacto con alérgenos del ambiente. Es muy frecuente y a menudo aparece junto con la rinitis alérgica, formando lo que se conoce como rinoconjuntivitis.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Picor ocular, que suele ser el síntoma más característico.",
          "Ojos rojos y sensación de arenilla.",
          "Lagrimeo abundante.",
          "Hinchazón leve de los párpados.",
          "Molestia con la luz en los casos más intensos.",
        ],
      },
      { type: "h2", text: "Desencadenantes frecuentes" },
      {
        type: "p",
        text: "Los desencadenantes son los mismos alérgenos respiratorios: pólenes en primavera y verano, ácaros del polvo durante todo el año, hongos del ambiente y epitelios de mascotas. Frotarse los ojos, aunque alivia momentáneamente, tiende a empeorar la irritación.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "El manejo combina medidas para reducir la exposición, el uso de compresas frías y el tratamiento indicado para controlar el picor y la inflamación. Como suele asociarse a la rinitis, el abordaje conjunto da mejores resultados. Los medicamentos específicos se definen en la consulta médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Consulta si el picor y el enrojecimiento se repiten, interfieren con tus actividades o no mejoran con medidas generales. Busca evaluación si aparece dolor ocular, cambios en la visión o secreción purulenta, ya que pueden indicar otra causa que requiere atención específica.",
      },
    ],
  },
  {
    slug: "alergia-veneno-insectos",
    title: "Alergia al veneno de insectos",
    category: "Insectos",
    summary:
      "Reacción alérgica a la picadura de abejas o avispas. En personas sensibilizadas puede ser grave; la inmunoterapia con veneno reduce el riesgo de reacciones futuras.",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "La mayoría de las personas presenta tras una picadura de abeja o avispa una reacción local normal: dolor, enrojecimiento e hinchazón en la zona, que cede en horas o pocos días. En las personas alérgicas al veneno, en cambio, la reacción puede ser desproporcionada o generalizada y, en algunos casos, poner en riesgo la vida.",
      },
      { type: "h2", text: "Tipos de reacción" },
      {
        type: "ul",
        items: [
          "Reacción local normal: hinchazón y dolor limitados a la zona de la picadura.",
          "Reacción local extensa: hinchazón amplia que progresa en uno o dos días.",
          "Reacción generalizada: ronchas en todo el cuerpo, hinchazón a distancia.",
          "Anafilaxia: dificultad para respirar, mareo o desmayo; es una urgencia médica.",
        ],
      },
      { type: "h2", text: "Por qué es importante el estudio" },
      {
        type: "p",
        text: "Quien ha tenido una reacción generalizada a una picadura tiene mayor riesgo de presentar otra más grave en el futuro. El estudio alergológico permite confirmar la sensibilización al veneno y estimar ese riesgo, información clave para definir las medidas de prevención y tratamiento.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "Además de las medidas para evitar picaduras y de un plan de acción ante una reacción, la inmunoterapia con veneno de himenópteros es un tratamiento que, en pacientes seleccionados, reduce de forma importante el riesgo de reacciones graves futuras. La indicación, el protocolo y la eventual prescripción de adrenalina autoinyectable se definen siempre en la consulta médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Consulta si tras una picadura presentaste síntomas más allá de la zona afectada, como ronchas generalizadas, hinchazón a distancia o dificultad para respirar. Ante una reacción grave en curso, primero la urgencia: usa la adrenalina si la tienes indicada y acude de inmediato a un servicio de emergencia.",
      },
    ],
  },
  {
    slug: "alergia-al-latex",
    title: "Alergia al látex",
    category: "Piel",
    summary:
      "Reacción al caucho natural presente en guantes, globos y material médico. Afecta sobre todo a personas con exposición frecuente y puede asociarse a alergias a ciertas frutas.",
    readingMinutes: 4,
    body: [
      {
        type: "p",
        text: "La alergia al látex es una reacción a las proteínas del caucho natural, presente en productos como guantes, globos, elásticos y diverso material sanitario. Es más frecuente en personas con exposición repetida, como trabajadores de la salud o pacientes con múltiples procedimientos, y conviene reconocerla porque condiciona precauciones en el ámbito médico.",
      },
      { type: "h2", text: "Síntomas habituales" },
      {
        type: "ul",
        items: [
          "Picor, enrojecimiento o ronchas en la zona de contacto con el látex.",
          "Síntomas respiratorios al inhalar partículas, por ejemplo con guantes empolvados.",
          "En casos más intensos, reacciones generalizadas.",
          "Molestias al contacto con globos, guantes domésticos o material elástico.",
        ],
      },
      { type: "h2", text: "Relación con algunos alimentos" },
      {
        type: "p",
        text: "Algunas personas alérgicas al látex pueden reaccionar también a ciertas frutas, como plátano, kiwi, palta o castaña, debido a proteínas parecidas. Es el llamado síndrome látex-fruta, que el especialista evalúa según cada caso.",
      },
      { type: "h2", text: "Cómo se maneja" },
      {
        type: "p",
        text: "La base del manejo es evitar el contacto con látex y avisar de la alergia en cualquier atención médica o dental para que se usen materiales libres de látex. El estudio confirma el diagnóstico y orienta las precauciones. El plan específico se define en la consulta médica.",
      },
      { type: "h2", text: "Cuándo consultar" },
      {
        type: "p",
        text: "Consulta si notas síntomas al contacto con guantes, globos o material elástico, o si tienes exposición frecuente al látex y antecedentes de reacciones. Informar esta alergia antes de cualquier procedimiento médico es una medida de seguridad importante.",
      },
    ],
  },
];

export function getTopic(slug: string): EducationTopic | undefined {
  return educationTopics.find((topic) => topic.slug === slug);
}
