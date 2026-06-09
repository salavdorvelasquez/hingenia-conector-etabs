/* ===================================================================
   Zonificación sísmica E.030 (2026) — ANEXO II OFICIAL
   Departamento → Provincia → Distrito → Zona sísmica (1..4)
   Fuente: Norma Técnica E.030, RM N° 183-2026-VIVIENDA (El Peruano, 03/05/2026).
   Formato compacto: ZP_RAW[dep][prov] = [[zona, [distritos...]], ...]
   =================================================================== */
const ZP_RAW = {
 "Amazonas": {
  "Chachapoyas": [[2,["Asunción","Balsas","Chachapoyas","Cheto","Chiliquín","Chuquibamba","Granada","Huancas","La Jalca","Leimebamba","Levanto","Magdalena","Mariscal Castilla","Molinopampa","Montevideo","Olleros","Quinjalca","San Francisco de Daguas","San Isidro de Maino","Soloco","Sonche"]]],
  "Bagua": [[2,["Aramango","Bagua","Copallín","El Parco","Imaza","La Peca"]]],
  "Bongará": [[2,["Chisquilla","Churuja","Corosha","Cuispes","Florida","Jazán","Jumbilla","Recta","San Carlos","Shipasbamba","Valera","Yambrasbamba"]]],
  "Condorcanqui": [[2,["El Cenepa","Nieva","Río Santiago"]]],
  "Luya": [[2,["Camporredondo","Cocabamba","Colcamar","Conila","Inguilpata","Lámud","Longuita","Lonya Chico","Luya","Luya Viejo","María","Ocalli","Ocumal","Pisuquia","Providencia","San Cristóbal","San Francisco del Yeso","San Jerónimo","San Juan de Lopecancha","Santa Catalina","Santo Tomás","Tingo","Trita"]]],
  "Utcubamba": [[2,["Bagua Grande","Cajaruro","Cumba","El Milagro","Jamalca","Lonya Grande","Yamón"]]],
  "Rodríguez de Mendoza": [[2,["Chirimoto","Cochamal","Huambo","Limabamba","Longar","Mariscal Benavides","Milpuc","Omia","San Nicolás","Santa Rosa","Totora"]],[3,["Vista Alegre"]]]
 },
 "Áncash": {
  "Antonio Raymondi": [[2,["Chaccho","Chingas","Llamellín"]],[3,["Aczo","Mirgas","San Juan de Rontoy"]]],
  "Huari": [[2,["Anra","Huacachi","Huacchis","Paucas","Rapayan","Uco"]],[3,["Cajay","Chavín de Huántar","Huachis","Huántar","Huari","Masín","Ponto","Rahuapampa","San Marcos","San Pedro de Chana"]]],
  "Asunción": [[3,["Acochaca","Chacas"]]],
  "Carhuaz": [[3,["Acopampa","Amashca","Anta","Ataquero","Carhuaz","Marcará","Pariahuanca","San Miguel de Aco","Shilla","Tinco","Yungar"]]],
  "Carlos Fermín Fitzcarrald": [[3,["San Luis","San Nicolás","Yauya"]]],
  "Corongo": [[3,["Aco","Bambas","Corongo","Cusca","La Pampa","Yánac","Yupán"]]],
  "Mariscal Luzuriaga": [[3,["Casca","Eleazar Guzmán Barrón","Fidel Olivas Escudero","Llama","Llumpa","Lucma","Musga","Piscobamba"]]],
  "Pallasca": [[3,["Bolognesi","Cabana","Conchucos","Huacaschuque","Huandoval","Lacabamba","Llapo","Pallasca","Pampas","Santa Rosa","Tauca"]]],
  "Pomabamba": [[3,["Huayllán","Parobamba","Pomabamba","Quinuabamba"]]],
  "Sihuas": [[3,["Acobamba","Alfonso Ugarte","Cashapampa","Chingalpo","Huayllabamba","Quiches","Ragash","San Juan","Sicsibamba","Sihuas"]]],
  "Huaylas": [[3,["Caraz","Huallanca","Huata","Huaylas","Mato","Pamparomás","Pueblo Libre","Santa Cruz","Santo Toribio","Yuracmarca"]]],
  "Yungay": [[3,["Cascapara","Mancos","Matacoto","Quillo","Ranrahirca","Shupluy","Yanama","Yungay"]]],
  "Huaraz": [[3,["Cochabamba","Colcabamba","Huanchay","Huaraz","Independencia","Jangas","La Libertad","Olleros","Pampas Grande","Pariacoto","Pira","Tarica"]]],
  "Bolognesi": [[3,["Abelardo Pardo Lezameta","Antonio Raymondi","Aquia","Cajacay","Canis","Chiquián","Colquioc","Huallanca","Huasta","Huayllacayán","La Primavera","Mangas","Pacllón","San Miguel de Corpanqui","Ticllos"]]],
  "Recuay": [[3,["Cátac","Cotaparaco","Huayllapampa","Llacllin","Marca","Pampas Chico","Pararín","Recuay","Tapacocha","Ticapampa"]]],
  "Aija": [[3,["Aija","Coris","La Merced","Huacllán","Succha"]]],
  "Ocros": [[3,["Acas","Cajamarquilla","Carhuapampa","Congas","Llipa","Ocros","San Cristóbal de Raján","Santiago de Chilcas"]],[4,["Cochas","San Pedro"]]],
  "Huarmey": [[3,["Cochapeti","Huayán","Malvas"]],[4,["Culebras","Huarmey"]]],
  "Santa": [[3,["Cáceres del Perú","Macate","Moro"]],[4,["Chimbote","Coishco","Nepeña","Nuevo Chimbote","Samanco","Santa"]]],
  "Casma": [[4,["Buena Vista Alta","Casma","Comandante Noél","Yaután"]]]
 },
 "Apurímac": {
  "Cotabambas": [[2,["Challhuahuacho","Cotabambas","Coyllurqui","Haquira","Mara","Tambobamba"]]],
  "Grau": [[2,["Chuquibambilla","Curasco","Curpahuasi","Gamarra","Huayllati","Mamara","Micaela Bastidas","Pataypampa","Progreso","San Antonio","Santa Rosa","Turpay","Vilcabamba","Virundo"]]],
  "Abancay": [[2,["Abancay","Chacoche","Circa","Curahuasi","Huanipaca","Lambrama","Pichirhua","San Pedro de Cachora","Tamburco"]]],
  "Chincheros": [[2,["Anco-Huallo","Chincheros","Cocharcas","Huaccana","Ocobamba","Ongoy","Ranracancha","Uranmarca","El Porvenir","Los Chankas","Rocchacc","Ahuayro"]]],
  "Andahuaylas": [[2,["Andahuaylas","Andarapa","Huancarama","Huancaray","Kaquiabamba","Kishuara","Pacobamba","Pacucha","San Antonio de Cachi","San Jerónimo","Santa María de Chicmo","Talavera","Turpo","José María Arguedas"]],[3,["Chiara","Huayana","Pampachiri","Pomacocha","San Miguel de Chaccrampa","Tumay Huaraca"]]],
  "Aymaraes": [[2,["Chapimarca","Colcabamba","Lucre","San Juan de Chacña","Tintay"]],[3,["Capaya","Caraybamba","Chalhuanca","Cotaruse","Ihuayllo","Justo Apu Sahuaraura","Pocohuanca","Sañayca","Soraya","Tapairihua","Toraya","Yanaca"]]],
  "Antabamba": [[3,["Antabamba","El Oro","Huaquirca","Juan Espinoza Medrano","Oropesa","Pachaconas","Sabaino"]]]
 },
 "Arequipa": {
  "La Unión": [[3,["Alca","Charcana","Cotahuasi","Huaynacotas","Pampamarca","Puyca","Quechualla","Sayla","Tauria","Tomepampa","Toro"]]],
  "Caylloma": [[3,["Achoma","Cabanaconde","Callalli","Caylloma","Chivay","Coporaque","Huambo","Huanca","Ichupampa","Lari","Lluta","Maca","Madrigal","San Antonio de Chuca","Sibayo","Tapay","Tisco","Tuti","Yanque"]],[4,["Majes"]]],
  "Castilla": [[3,["Andagua","Ayo","Chachas","Chilcaymarca","Choco","Machaguay","Orcopampa","Pampacolca","Tipán","Uñón","Viraco"]],[4,["Aplao","Huancarqui","Uraca"]]],
  "Arequipa": [[3,["Alto Selva Alegre","Arequipa","Cayma","Cerro Colorado","Characato","Chiguata","Jacobo Hunter","José Luis Bustamante y Rivero","Mariano Melgar","Miraflores","Mollebaya","Paucarpata","Pocsi","Quequeña","Sabandia","Sachaca","San Juan de Tarucani","Socabaya","Tiabaya","Yanahuara","Yura"]],[4,["La Joya","Polobaya","San Juan de Siguas","Santa Isabel de Siguas","Santa Rita de Siguas","Uchumayo","Vitor","Yarabamba"]]],
  "Condesuyos": [[3,["Cayarani","Chichas","Salamanca"]],[4,["Andaray","Chuquibamba","Iray","Río Grande","Yanaquihua"]]],
  "Islay": [[4,["Cocachacra","Dean Valdivia","Islay","Mejía","Mollendo","Punta de Bombón"]]],
  "Camaná": [[4,["Camaná","José María Quimper","Mariano Nicolás Valcárcel","Mariscal Cáceres","Nicolás de Piérola","Ocoña","Quilca","Samuel Pastor"]]],
  "Caravelí": [[4,["Acari","Atico","Atiquipa","Bella Unión","Cahuacho","Caravelí","Chala","Chaparra","Huanuhuanu","Jaqui","Lomas","Quicacha","Yauca"]]]
 },
 "Ayacucho": {
  "Huanta": [[2,["Ayahuanco","Iguain","Huamanguilla","Huanta","Llochegua","Luricocha","Santillana","Sivia","Chaca","Pucacolpa","Uchuraccay","Canayre","Putis"]]],
  "La Mar": [[2,["Anco","Ayna","Chilcas","Chungui","Luis Carranza","San Miguel","Santa Rosa","Tambo","Oronccoy","Anchihuay","Samugari","Union Progreso","Rio Magdalena","Ninabamba","Patibamba"]]],
  "Huamanga": [[2,["Acocro","Acos Vinchos","Ayacucho","Andrés Avelino Cáceres Dorregaray","Jesús Nazareno","Ocros","Pacaycasa","Quinua","San José de Ticllas","Santiago de Pischa","Tambillo"]],[3,["Carmen Alto","Chiara","San Juan Bautista","Socos","Vinchos"]]],
  "Vilcashuamán": [[2,["Concepción"]],[3,["Accomarca","Carhuanca","Huambalpa","Independencia","Saurama","Vilcas Huamán","Vischongo"]]],
  "Huancasancos": [[3,["Carapo","Sacsamarca","Sancos","Santiago de Lucanamarca"]]],
  "Cangallo": [[3,["Cangallo","Chuschi","Los Morochucos","María Parado de Bellido","Paras","Totos"]]],
  "Páucar del Sara Sara": [[3,["Colta","Corculla","Lampa","Marcabamba","Oyolo","Pararca","Pausa","San Javier de Alpabamba","San José de Ushua","Sara Sara"]]],
  "Sucre": [[3,["Belén","Chalcos","Chilcayoc","Huacaña","Morcolla","Paico","Querobamba","San Pedro de Larcay","San Salvador de Quije","Santiago de Paucaray","Soras"]]],
  "Víctor Fajardo": [[3,["Alcamenca","Apongo","Asquipata","Canaria","Cayara","Colca","Huamanquiquia","Huancapi","Huancaraylla","Hualla","Sarhua","Vilcanchos"]]],
  "Parinacochas": [[3,["Chumpi","Coracora","Coronel Castañeda","Pacapausa","San Francisco de Rivacayco","Upahuacho"]],[4,["Pullo","Puyusca"]]],
  "Lucanas": [[3,["Aucara","Cabana","Carmen Salcedo","Chaviña","Chipao","Lucanas","Puquio","San Juan","San Pedro de Palco","Santa Ana de Huaycahuacho"]],[4,["Huac-Huas","Laramate","Leoncio Prado","Llauta","Ocaña","Otoca","Saisa","San Cristóbal","San Pedro","Sancos","Santa Lucia"]]]
 },
 "Cajamarca": {
  "Hualgayoc": [[2,["Bambamarca","Chugur","Hualgayoc"]]],
  "San Ignacio": [[2,["Chirinos","Huarango","La Coipa","Namballe","San Ignacio","San José de Lourdes","Tabaconas"]]],
  "Celendín": [[2,["Celendín","Chumuch","Cortegana","Huasmín","Jorge Chávez","José Gálvez","La Libertad de Pallán","Miguel Iglesias","Oxamarca","Sorochuco","Sucre","Utco"]]],
  "Cutervo": [[2,["Callayuc","Choros","Cujillo","Cutervo","La Ramada","Pimpingos","San Andrés de Cutervo","San Juan de Cutervo","San Luis de Lucma","Santa Cruz","Santo Domingo de la Capilla","Santo Tomás","Socota","Toribio Casanova"]],[3,["Querocotillo"]]],
  "Jaén": [[2,["Bellavista","Chontali","Colasay","Huabal","Jaén","Las Pirias","San José del Alto","Santa Rosa"]],[3,["Pomahuaca","Pucará","Sallique","San Felipe"]]],
  "San Marcos": [[2,["Gregorio Pita","Ichocán","José Manuel Quiroz","José Sabogal"]],[3,["Chancay","Eduardo Villanueva","Pedro Gálvez"]]],
  "Chota": [[2,["Anguia","Chadin","Chalamarca","Chiguirip","Chimbán","Choropampa","Chota","Conchán","Lajas","Paccha","Pión","Tacabamba"]],[3,["Cochabamba","Huambos","Llama","Miracosta","Querocoto","San Juan de Licupis","Tocmoche"]]],
  "Cajabamba": [[2,["Sitacocha"]],[3,["Cachachi","Cajabamba","Condebamba"]]],
  "Cajamarca": [[2,["Encañada"]],[3,["Asunción","Cajamarca","Chetilla","Cospán","Jesús","Llacanora","Los Baños del Inca","Magdalena","Matara","Namora","San Juan"]]],
  "Contumazá": [[3,["Chilete","Contumazá","Cupisnique","Guzmango","San Benito","Santa Cruz de Toledo","Tantarica","Yonán"]]],
  "San Miguel": [[3,["Bolívar","Calquis","Catilluc","El Prado","La Florida","Llapa","Nanchoc","Niepos","San Gregorio","San Miguel","San Silvestre de Cochán","Tongod","Unión Agua Blanca"]]],
  "San Pablo": [[2,["San Bernardino","San Luis","San Pablo","Tumbadén"]]],
  "Santa Cruz": [[2,["Andabamba","Catache","Chancaybaños","La Esperanza","Ninabamba","Pulán","Santa Cruz","Saucepampa","Sexi","Uticyacu","Yauyucán"]]]
 },
 "Callao": {
  "Callao": [[4,["Bellavista","Callao","Carmen de la Legua Reynoso","La Perla","La Punta","Ventanilla","Mi Perú"]]]
 },
 "Cusco": {
  "Calca": [[2,["Calca","Coya","Lamay","Lares","Pisac","San Salvador","Taray","Yanatile"]]],
  "Urubamba": [[2,["Chinchero","Huayllabamba","Machupicchu","Maras","Ollantaytambo","Urubamba","Yucay"]]],
  "Paucartambo": [[2,["Caicay","Challabamba","Colquepata","Huancarani","Kosñipata","Paucartambo"]]],
  "Anta": [[2,["Ancahuasi","Anta","Cachimayo","Chinchaypujio","Huarocondo","Limatambo","Mollepata","Pucyura","Zurite"]]],
  "Quispicanchis": [[2,["Andahuaylillas","Camanti","Ccarhuayo","Ccatca","Cusipata","Huaro","Lucre","Marcapata","Ocongate","Oropesa","Quiquijana","Urcos"]]],
  "Paruro": [[2,["Accha","Ccapi","Colcha","Huanoquite","Omacha","Paccaritambo","Paruro","Pillpinto","Yaurisque"]]],
  "Canchis": [[2,["Sicuani","Combapata","Marangani","Pitumarca","San Pablo","San Pedro","Checacupe","Tinta"]]],
  "Canas": [[2,["Checca","Kunturkanki","Langui","Layo","Pampamarca","Quehue","Túpac Amaru","Yanaoca"]]],
  "Acomayo": [[2,["Acomayo","Acopia","Acos","Mosoc Llacta","Pomacanchi","Rondocán","Sangarara"]]],
  "Cusco": [[2,["Ccorca","Cusco","Poroy","San Jerónimo","San Sebastián","Santiago","Saylla","Wanchaq"]]],
  "La Convención": [[2,["Echarate","Huayopata","Maranura","Ocobamba","Pichari","Quellouno","Kimbiri","Santa Ana","Santa Teresa","Vilcabamba","Megantoni","Villa Kintiarina","Villa Virgen","Inkawasi","Kumpirushiato","Cielo Punco","Manitea","Unión Ashaninka"]]],
  "Chumbivilcas": [[2,["Capacmarca","Chamaca","Colquemarca","Livitaca"]],[3,["Llusco","Quiñota","Santo Tomás","Velille"]]],
  "Espinar": [[3,["Condoroma","Coporaque","Espinar","Ocoruro","Pallpata","Pichigua","Suyckutambo","Alto Pichigua"]]]
 },
 "Huancavelica": {
  "Churcampa": [[2,["Anco","Chinchihuasi","Churcampa","Cosme","El Carmen","La Merced","Locroja","Pachamarca","Paucarbamba","San Miguel de Mayocc","San Pedro de Coris"]]],
  "Acobamba": [[2,["Acobamba","Andabamba","Anta","Caja","Marcas","Paucara","Pomacocha","Rosario"]]],
  "Tayacaja": [[2,["Colcabamba","Quichuas","Daniel Hernández","Huachocolpa","Huaribamba","Quishuar","Salcabamba","San Marcos de Rocchac","Salcahuasi","Surcubamba","Tintay Puncu","Pichos","Roble","Andaymarca","Lambras","Cochabamba"]],[3,["Acostambo","Acraquia","Ahuaycha","Huando","Ñahuimpuquio","Pampas","Pazos","Santiago de Tucuma"]]],
  "Angaraes": [[2,["Chincho"]],[3,["Anchonga","Callanmarca","Ccochaccasa","Congalla","Huanca-Huanca","Huayllay Grande","Julcamarca","Lircay","San Antonio de Antaparco","Secclla","Santo Tomás de Pata"]]],
  "Huancavelica": [[3,["Acobambilla","Acoria","Ascensión","Conayca","Cuenca","Huachocolpa","Huancavelica","Huayllahuara","Izcuchaca","Laria","Manta","Mariscal Cáceres","Moya","Nuevo Occoro","Palca","Pilchaca","Vilca","Yauli"]]],
  "Castrovirreyna": [[3,["Arma","Aurahua","Castrovirreyna","Chupamarca","Cocas","Huachos","Huamatambo","Mollepampa","Santa Ana","Tantara","Ticrapo"]],[4,["Capillas","San Juan"]]],
  "Huaytará": [[3,["San Antonio de Cusicancha","Pilpichaca","Querco"]],[4,["Ayavi","Córdova","Huayacundo Arma","Huaytará","Laramarca","Ocoyo","Quito-Arma","San Francisco de Sangayaico","San Isidro","Santiago de Chocorvos","Santiago de Quirahuara","Santo Domingo de Capillas","Tambo"]]]
 },
 "Huánuco": {
  "Huánuco": [[2,["Huánuco","Amarilis","Chinchao","Churubamba","Margos","Pillco Marca","Quisqui","San Francisco de Cayrán","San Pedro de Chaulan","Santa María del Valle","Yarumayo","Yacus","San Pablo de Pillao"]]],
  "Huacaybamba": [[2,["Huacaybamba","Canchabamba","Cochabamba","Pinra"]]],
  "Leoncio Prado": [[2,["Rupa-Rupa","José Crespo y Castillo","Mariano Damaso Beraún","Daniel Alomia Robles","Luyando","Hermilio Valdizán","Castillo Grande","Pucayacu","Santo Domingo de Anda","Pueblo Nuevo"]]],
  "Marañón": [[2,["Huacrachuco","Cholón","San Buenaventura","La Morada","Santa Rosa de Alto Yanajanca"]]],
  "Puerto Inca": [[2,["Puerto Inca","Codo del Pozuzo","Honoria","Tournavista","Yuyapichis"]]],
  "Yarowilca": [[2,["Chavinillo","Cahuac","Chacabamba","Aparicio Pomares","Jacas Chico","Obas","Pampamarca","Choras"]]],
  "Pachitea": [[2,["Panao","Chaglla","Molino","Umari"]]],
  "Ambo": [[2,["Ambo","Cayna","Colpas","Conchamarca","Huacar","San Francisco","San Rafael","Tomay Kichwa"]]],
  "Huamalíes": [[2,["Arancay","Chavín de Pariarca","Jacas Grande","Jircan","Monzón","Punchao","Singa","Tantamayo"]],[3,["Llata","Miraflores","Puños"]]],
  "Dos de Mayo": [[2,["Chuquis","Marías","Quivilla"]],[3,["La Unión","Pachas","Ripan","Shunqui","Sillapata","Yanas"]]],
  "Lauricocha": [[3,["Baños","Jesús","Jivia","Queropalca","Rondos","San Francisco de Asis","San Miguel de Cauri"]]]
 },
 "Ica": {
  "Chincha": [[3,["San Pedro de Huacarpana"]],[4,["Alto Laran","Chavín","Chincha Alta","Chincha Baja","El Carmen","Grocio Prado","Pueblo Nuevo","San Juan de Yánac","Sunampe","Tambo de Mora"]]],
  "Palpa": [[4,["Llipata","Palpa","Río Grande","Santa Cruz","Tibillo"]]],
  "Ica": [[4,["Ica","La Tinguiña","Los Aquijes","Ocucaje","Pachacútec","Parcona","Pueblo Nuevo","Salas","San José de los Molinos","San Juan Bautista","Santiago","Subtanjalla","Tate","Yauca del Rosario"]]],
  "Nazca": [[4,["Changuillo","El Ingenio","Marcona","Nasca","Vista Alegre"]]],
  "Pisco": [[4,["Huancano","Humay","Independencia","Paracas","Pisco","San Andrés","San Clemente","Túpac Amaru Inca"]]]
 },
 "Junín": {
  "Chanchamayo": [[2,["Chanchamayo","Perené","Pichanaqui","San Luis de Shuaro","San Ramón","Vitoc"]]],
  "Satipo": [[2,["Coviriali","Llaylla","Mazamari","Pampa Hermosa","Pangoa","Río Negro","Río Tambo","Satipo","Vizcatán del Ene"]]],
  "Tarma": [[2,["Acobamba","Huasahuasi","Palca","Palcamayo","San Pedro de Cajas","Tapo"]],[3,["Huaricolca","La Unión","Tarma"]]],
  "Concepción": [[2,["Andamarca","Cochas","Comas","Mariscal Castilla"]],[3,["Aco","Chambará","Concepción","Heroínas Toledo","Manzanares","Matahuasi","Mito","Nueve de Julio","Orcotuna","San José de Quero","Santa Rosa de Ocopa"]]],
  "Chupaca": [[3,["Ahuac","Chongos Bajo","Chupaca","Huáchac","Huamancaca Chico","San Juan de Jarpa","San Juan de Iscos","Tres de Diciembre","Yanacancha"]]],
  "Huancayo": [[2,["Pariahuanca","Santo Domingo de Acobamba"]],[3,["Carhuacallanga","Chacapampa","Chicche","Chilca","Chongos Alto","Chupuro","Colca","Cullhuas","El Tambo","Huacrapuquio","Hualhuas","Huancán","Huancayo","Huasicancha","Huayucachi","Ingenio","Pilcomayo","Pucará","Quichuay","Quilcas","San Agustín","San Jerónimo de Tunán","Saño","Sapallanga","Sicaya","Viques"]]],
  "Jauja": [[2,["Apata","Molinos","Monobamba","Ricrán"]],[3,["Acolla","Ataura","Canchayllo","Curicaca","El Mantaro","Huamalí","Huaripampa","Huertas","Janjaillo","Jauja","Julcán","Leonor Ordóñez","Llocllapampa","Marco","Masma","Masma Chicche","Muqui","Muquiyauyo","Paca","Paccha","Pancán","Parco","Pomacancha","San Lorenzo","San Pedro de Chunán","Sausa","Sincos","Tunan Marca","Yauli","Yauyos"]]],
  "Junín": [[2,["Carhuamayo","Ulcumayo"]],[3,["Junín","Ondores"]]],
  "Yauli": [[3,["Chacapalpa","Huay-Huay","La Oroya","Marcapomacocha","Morococha","Paccha","Santa Bárbara de Carhuacayán","Santa Rosa de Sacco","Suitucancha","Yauli"]]]
 },
 "La Libertad": {
  "Bolívar": [[2,["Bambamarca","Bolívar","Condormarca","Longotea","Uchumarca","Ucuncha"]]],
  "Pataz": [[2,["Buldibuyo","Chillia","Huancaspata","Huaylillas","Huayo","Ongon","Parcoy","Pataz","Pias","Santiago de Challas","Taurija","Tayabamba","Urpay"]]],
  "Sánchez Carrión": [[2,["Cochorco","Sartimbamba"]],[3,["Chugay","Curgos","Huamachuco","Marcabal","Sanagoran","Sarín"]]],
  "Santiago de Chuco": [[3,["Angasmarca","Cachicadan","Mollebamba","Mollepata","Quiruvilca","Santa Cruz de Chuca","Santiago de Chuco","Sitabamba"]]],
  "Gran Chimú": [[3,["Cascas","Lucma","Marmot","Sayapullo"]]],
  "Julcán": [[3,["Calamarca","Carabamba","Huaso","Julcán"]]],
  "Otuzco": [[3,["Agallpampa","Charat","Huaranchal","La Cuesta","Mache","Otuzco","Paranday","Salpo","Sinsicap","Usquil"]]],
  "Chepén": [[4,["Chepén","Pacanga","Pueblo Nuevo"]]],
  "Ascope": [[4,["Ascope","Casa Grande","Chicama","Chocope","Magdalena de Cao","Paiján","Rázuri","Santiago de Cao"]]],
  "Pacasmayo": [[4,["Guadalupe","Jequetepeque","Pacasmayo","San José","San Pedro de Lloc"]]],
  "Trujillo": [[4,["El Porvenir","Florencia de Mora","Huanchaco","La Esperanza","Laredo","Moche","Poroto","Salaverry","Simbal","Trujillo","Víctor Larco Herrera","Alto Trujillo"]]],
  "Virú": [[4,["Chao","Guadalupito","Virú"]]]
 },
 "Lambayeque": {
  "Ferreñafe": [[3,["Cañaris","Incahuasi"]],[4,["Ferreñafe","Manuel Antonio Mesones Muro","Pitipo","Pueblo Nuevo"]]],
  "Lambayeque": [[3,["Salas"]],[4,["Chochope","Illimo","Jayanca","Lambayeque","Mochumi","Mórrope","Motupe","Olmos","Pacora","San José","Tucume"]]],
  "Chiclayo": [[4,["Cayaltí","Chiclayo","Chongoyape","Etén","Etén Puerto","José Leonardo Ortiz","La Victoria","Lagunas","Monsefú","Nueva Arica","Oyotun","Patapo","Picsi","Pimentel","Pomalca","Pucala","Reque","Santa Rosa","Saña","Tumán"]]]
 },
 "Lima": {
  "Cajatambo": [[3,["Cajatambo","Copa","Gorgor","Huancapón","Manas"]]],
  "Oyón": [[3,["Andajes","Caujul","Cochamarca","Naván","Oyón","Pachangara"]]],
  "Yauyos": [[3,["Alis","Allauca","Ayaviri","Azángaro","Cacra","Carania","Catahuasi","Chocos","Cochas","Colonia","Hongos","Huampara","Huancaya","Huangascar","Huantan","Huañec","Laraos","Lincha","Madean","Miraflores","Quinches","San Joaquín","Putinza","San Pedro de Pilas","Tanta","Tomás","Tupe","Viñac","Vitis","Yauyos"]],[4,["Omas","Quinocay","Tauripampa"]]],
  "Huarochirí": [[3,["Callahuanca","Carampoma","Chicla","Huachupampa","Huanza","Huarochirí","Lahuaytambo","Langa","San Pedro de Laraos","Matucana","San Andrés de Tupicocha","San Bartolomé","San Damian","Surco","San Juan de Iris","San Juan de Tantaranche","San Lorenzo de Quinti","San Mateo","San Mateo de Otao","San Pedro de Casta","San Pedro de Huancayre","Sangallaya","Santa Cruz de Cocachacra","Santiago de Anchucaya","Santiago de Tuna"]],[4,["Antioquía","Cuenca","Mariatana","Ricardo Palma","San Antonio","Santa Eulalia","Santo Domingo de los Olleros"]]],
  "Canta": [[3,["Canta","Huaros","Lachaqui","San Buenaventura"]],[4,["Arahuay","Huamantanga","Santa Rosa de Quives"]]],
  "Huaral": [[3,["Atavillos Alto","Atavillos Bajo","Ihuari","Lampián","Pacaraos","San Miguel de Acos","Santa Cruz de Andamarca","Sumbilca","Veintisiete de Noviembre"]],[4,["Aucallama","Chancay","Huaral"]]],
  "Huaura": [[3,["Checras","Leoncio Prado","Paccho","Santa Leonor"]],[4,["Ambar","Caleta de Carquín","Huacho","Hualmay","Huaura","Santa María","Sayán","Vegueta"]]],
  "Cañete": [[3,["Zuñiga"]],[4,["Asia","Calango","Cerro Azul","Chilca","Coayllo","Imperial","Lunahuana","Mala","Nuevo Imperial","Pacarán","Quilmana","San Antonio","San Luis","San Vicente de Cañete","Santa Cruz de Flores"]]],
  "Barranca": [[4,["Barranca","Paramonga","Pativilca","Supe","Supe Puerto"]]],
  "Lima": [[4,["Ancón","Ate","Barranco","Breña","Carabayllo","Chaclacayo","Chorrillos","Cieneguilla","Comas","El Agustino","Independencia","Jesús María","La Molina","La Victoria","Lima","Lince","Los Olivos","Lurigancho","Lurín","Magdalena del Mar","Miraflores","Pachacámac","Pucusana","Pueblo Libre","Puente Piedra","Punta Hermosa","Punta Negra","Rímac","San Bartolo","San Borja","San Isidro","San Juan de Lurigancho","San Juan de Miraflores","San Luis","San Martin de Porres","San Miguel","Santa Anita","Santa María del Mar","Santa Rosa","Santiago de Surco","Surquillo","Villa El Salvador","Villa María del Triunfo"]]]
 },
 "Loreto": {
  "Mariscal Ramón Castilla": [[1,["Ramón Castilla","Pebas","San Pablo","Yavari","Santa Rosa"]]],
  "Maynas": [[1,["Alto Nanay","Belén","Fernando Lores","Indiana","Iquitos","Las Amazonas","Mazan","Napo","Punchana","San Juan Bautista","Torres Causana"]]],
  "Requena": [[1,["Saquena"]],[2,["Requena","Capelo","Soplin","Tapiche","Jenaro Herrera","Yaquerana","Alto Tapiche","Emilio San Martín","Maquia","Puinahua"]]],
  "Loreto": [[2,["Nauta","Parinari","Tigre","Trompeteros","Urarinas"]]],
  "Alto Amazonas": [[2,["Lagunas"]],[3,["Yurimaguas","Balsapuerto","Jeberos","Santa Cruz","Teniente César López Rojas"]]],
  "Putumayo": [[1,["Teniente Manuel Clavero","Rosa Panduro","Putumayo","Yaguas"]]],
  "Ucayali": [[2,["Contamana","Inahuaya","Padre Márquez","Pampa Hermosa","Sarayacu","Vargas Guerra"]]],
  "Datem del Marañón": [[2,["Manseriche","Morona","Pastaza","Andoas"]],[3,["Barranca","Cahuapanas"]]]
 },
 "Madre de Dios": {
  "Tambopata": [[1,["Inambari","Laberinto","Las Piedras","Tambopata"]]],
  "Tahuamanu": [[1,["Iberia","Iñapari","Tahuamanu"]]],
  "Manu": [[2,["Fitzcarrald","Huepetuhe","Madre de Dios","Manu"]]]
 },
 "Moquegua": {
  "General Sánchez Cerro": [[3,["Chojata","Coalaque","Ichuña","Lloque","Matalaque","Omate","Puquina","Quinistaquillas","Ubinas","Yunga"]],[4,["La Capilla"]]],
  "Mariscal Nieto": [[3,["Carumas","Cuchumbaya","Samegua","San Cristóbal","Torata"]],[4,["Moquegua","San Antonio"]]],
  "Ilo": [[4,["El Algarrobal","Pacocha","Ilo"]]]
 },
 "Pasco": {
  "Oxapampa": [[2,["Oxapampa","Chontabamba","Huancabamba","Palcazu","Pozuzo","Puerto Bermúdez","Villa Rica","Constitución"]]],
  "Pasco": [[2,["Huachón","Huariaca","Ninacaca","Pallanchacra","Paucartambo","San Francisco de Asís de Yarusyacán","Ticlacayan","Yanacancha"]],[3,["Chaupimarca","Huayllay","Simón Bolívar","Tinyahuarco","Vicco"]]],
  "Daniel A. Carrión": [[3,["Yanahuanca","Chacayan","Goyllarisquizga","Paucar","San Pedro de Pillao","Santa Ana de Tusi","Tapuc","Vilcabamba"]]]
 },
 "Piura": {
  "Huancabamba": [[3,["Canchaque","El Carmen de la Frontera","Huancabamba","Huarmaca","Lalaquiz","San Miguel de El Faique","Sondor","Sondorillo"]]],
  "Ayabaca": [[3,["Ayabaca","Jilili","Lagunas","Montero","Pacaipampa","Sicchez"]],[4,["Frías","Paimas","Sapillica","Suyo"]]],
  "Morropón": [[3,["Buenos Aires","Chalaco","Salitral","San Juan de Bigote","Santa Catalina de Mossa","Yamango"]],[4,["Chulucanas","La Matanza","Morropón","Santo Domingo"]]],
  "Piura": [[4,["Castilla","Catacaos","Cura Mori","El Tallán","La Arena","La Unión","Las Lomas","Piura","Tambo Grande","Veintiséis de Octubre"]]],
  "Paita": [[4,["Amotape","Arenal","Colan","La Huaca","Paita","Tamarindo","Vichayal"]]],
  "Sechura": [[4,["Bellavista de la Unión","Bernal","Cristo Nos Valga","Rinconada Llicuar","Sechura","Vice"]]],
  "Sullana": [[4,["Bellavista","Ignacio Escudero","Lancones","Marcavelica","Miguel Checa","Querecotillo","Salitral","Sullana"]]],
  "Talara": [[4,["El Alto","La Brea","Lobitos","Los Órganos","Máncora","Pariñas"]]]
 },
 "Puno": {
  "Sandia": [[1,["Alto Inambari","San Juan del Oro","Yanahuaya"]],[2,["Cuyocuyo","Limbani","Patambuco","Phara","Quiaca","San Pedro de Putina Punco","Sandia"]]],
  "San Antonio de Putina": [[2,["Ananea","Quilcapuncu","Sina","Pedro Vilca Apaza","Putina"]]],
  "Carabaya": [[2,["Ayapata","Coasa","Crucero","Ituata","San Gabán","Usicayos","Ajoyani","Corani","Macusani","Ollachea"]]],
  "Huancané": [[2,["Cojata","Huancané","Huatasani","Inchupalla","Pusi","Rosaspata","Taraco","Vilque Chico"]]],
  "Moho": [[2,["Huayrapata","Moho","Conima","Tilali"]]],
  "Puno": [[2,["Coata","Capachica","Amantani"]],[3,["Acora","Atuncolla","Chucuito","Huata","Mañazo","Paucarcolla","Pichacani","Platería","Puno","San Antonio","Tiquillaca","Vilque"]]],
  "Azángaro": [[2,["Azángaro","Achaya","Arapa","Asillo","Caminaca","Chupa","José Domingo Choquehuanca","Muñani","Potoni","Saman","San Antón","San José","San Juan de Salinas","Santiago de Pupuja","Tirapata"]]],
  "Chucuito": [[3,["Desaguadero","Huacullani","Juli","Kelluyo","Pisacoma","Pomata","Zepita"]]],
  "El Collao": [[3,["Capazo","Conduriri","Ilave","Pilcuyo","Santa Rosa"]]],
  "Lampa": [[2,["Calapuja","Nicasio","Pucará"]],[3,["Cabanilla","Lampa","Ocuviri","Palca","Paratia","Santa Lucía","Vilavila"]]],
  "Melgar": [[2,["Antauta","Ayaviri","Cupi","Llalli","Macari","Nuñoa","Orurillo","Santa Rosa","Umachiri"]]],
  "San Román": [[3,["Juliaca","Cabana","Cabanillas","Caracoto","San Miguel"]]],
  "Yunguyo": [[3,["Yunguyo","Anapia","Copani","Cuturapi","Ollaraya","Tinicachi","Unicachi"]]]
 },
 "San Martín": {
  "Bellavista": [[2,["Bellavista","Alto Biavo","Bajo Biavo","Huallaga","San Pablo","San Rafael"]]],
  "Huallaga": [[2,["Saposoa","El Eslabón","Piscoyacu","Sacanche","Tingo de Saposoa","Alto Saposoa"]]],
  "Lamas": [[3,["Lamas","Alonso de Alvarado","Barranquita","Caynarachi","Cuñumbuqui","Pinto Recodo","Rumisapa","San Roque de Cumbaza","Shanao","Tabalosos","Zapatero"]]],
  "Mariscal Cáceres": [[2,["Juanjuí","Campanilla","Huicungo","Pachiza","Pajarillo"]]],
  "Picota": [[2,["Picota","Buenos Aires","Caspisapa","Pilluana","Pucacaca","San Cristóbal","San Hilarión","Shamboyacu","Tingo de Ponasa","Tres Unidos"]]],
  "Moyobamba": [[3,["Moyobamba","Calzada","Habana","Jepelacio","Soritor","Yantalo"]]],
  "Rioja": [[3,["Rioja","Awajun","Elias Soplín Vargas","Nueva Cajamarca","Pardo Miguel","Posic","San Fernando","Yorongos","Yuracyacu"]]],
  "San Martín": [[2,["Chipurana","El Porvenir","Huimbayoc","Papaplaya"]],[3,["Tarapoto","Alberto Leveau","Cacatachi","Chazuta","Juan Guerra","La Banda de Shilcayo","Morales","San Antonio","Sauce","Shapaja"]]],
  "Tocache": [[2,["Tocache","Nuevo Progreso","Pólvora","Shunte","Uchiza","Santa Lucia"]]],
  "El Dorado": [[3,["San José de Sisa","Agua Blanca","San Martín","Santa Rosa","Shatoja"]]]
 },
 "Tacna": {
  "Tarata": [[3,["Héroes Albarracín","Estique","Estique-Pampa","Sitajara","Susapaya","Tarata","Tarucachi","Ticaco"]]],
  "Candarave": [[3,["Cairani","Camilaca","Candarave","Curibaya","Huanuara","Quilahuani"]]],
  "Jorge Basadre": [[4,["Ilabaya","Ite","Locumba"]]],
  "Tacna": [[3,["Palca"]],[4,["Alto de la Alianza","Calana","Ciudad Nueva","Inclán","Pachia","Pocollay","Sama","Tacna","La Yarada Los Palos","Coronel Gregorio Albarracin Lanchipa"]]]
 },
 "Tumbes": {
  "Contralmirante Villar": [[4,["Casitas","Zorritos","Canoas de Punta Sal"]]],
  "Tumbes": [[4,["Corrales","La Cruz","Pampas de Hospital","San Jacinto","San Juan de la Virgen","Tumbes"]]],
  "Zarumilla": [[4,["Aguas Verdes","Matapalo","Papayal","Zarumilla"]]]
 },
 "Ucayali": {
  "Purús": [[1,["Purús"]]],
  "Atalaya": [[2,["Raimondi","Sepahua","Tahuania","Yurua"]]],
  "Padre Abad": [[2,["Curimaná","Irazola","Padre Abad","Alexander von Humboldt","Neshuya","Huipoca","Boqueron"]]],
  "Coronel Portillo": [[2,["Calleria","Campoverde","Iparia","Manantay","Masisea","Nueva Requena","Yarinacocha"]]]
 }
};

// Construye ZONAS_PERU[dep][prov][distrito] = "Z1".."Z4"
const ZONAS_PERU = {};
for (const dep in ZP_RAW) {
  ZONAS_PERU[dep] = {};
  for (const prov in ZP_RAW[dep]) {
    ZONAS_PERU[dep][prov] = {};
    for (const grupo of ZP_RAW[dep][prov]) {
      const z = "Z" + grupo[0];
      for (const dist of grupo[1]) ZONAS_PERU[dep][prov][dist] = z;
    }
  }
}
