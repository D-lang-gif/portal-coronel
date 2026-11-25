/* Obras del Plan Fluye geocodificadas desde OSM (© OpenStreetMap contributors, ODbL),
   el dossier Plan Fluye (abril 2026), el Decreto 422 y el boletín municipal del 27-oct-2026.
   No se inventan trazos. geom = coordenadas locales del visor 3D; ll = WGS84 [lat, lon] para el mapa. */
window.PLAN_FLUYE = {
  "meta": {
    "titulo": "Obras del Plan Fluye con geometría fuente",
    "crs": "geom: coordenadas locales del visor (UTM 13N relativas al Nodo, mismo que CIUDAD_OSM). ll: WGS84 [lat, lon] para el mapa Leaflet.",
    "principio": "No se inventan ubicaciones ni trazos de tubería. Solo calles, predios o coordenadas con fuente pública (Plan Fluye, Decreto 422, boletín municipal u OSM).",
    "omitidas": [
      "Emisor Central y colector San Ignacio: sin plano público de SIDEAPA; en el mapa solo el destino (PTAR Norte).",
      "Calle Madero (2 tramos, Col. Centro): el plan no publica las esquinas.",
      "Calle Oceanía (Fracc. La Feria): no está en el extracto OSM de la zona.",
      "Rincón del Pedregal y Col. Francisco Zarco: sin calle acotada ni lugar OSM unívoco.",
      "Cárcamo Urbivillas, interconexión El Vergel–El Refugio, pluvial Morelos I y pluvial Urbivillas: sin coordenada unívoca.",
      "Programa Ramo 33 en colonias (Centro, Bellavista, Santa Rosa, San Ángel, Filadelfia, El Dorado, Valle Campestre, Revolución, La Herradura) cuando no hay calle publicada."
    ],
    "frase": "El Plan Fluye pone la base y el Nodo la protege a futuro.",
    "cifras": {
      "emisor_inversion_mdp": 570,
      "emisor_inversion_nota": "Se usa 570, cifra del plan firmado en abril de 2026. El boletín del Ayuntamiento del 27 de octubre de 2026 menciona 575 MDP para el Emisor Central y el colector San Ignacio.",
      "emisor_km": 13.27,
      "emisor_diametro_m": 1.83,
      "emisor_pulgadas": 72,
      "san_ignacio_pulgadas": 60,
      "material": "poliéster reforzado con fibra de vidrio",
      "residuales_pct": 80,
      "habitantes": 262000,
      "ptar_norte_modulo_lps": 250,
      "ptar_norte_proyectada_lps": 750,
      "ptar_norte_inversion_mdp": 500,
      "ptar_oriente_proyectada_lps": 250,
      "ramo33_mdp": 84.5,
      "mercado_abastos_mdp": 11,
      "obras_complementarias_mdp": 188,
      "jerarquia": "atarjea 20 cm → subcolector 25–45 cm → colector ≥ 60 cm → emisor 1.83 m"
    },
    "fuentes": [
      {
        "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier firmado por la Lic. Betzabé Martínez Arango, abril 2026)",
        "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf"
      },
      {
        "titulo": "Ayuntamiento de Gómez Palacio, boletín 27 de octubre de 2026",
        "url": "https://www.gomezpalacio.gob.mx/"
      },
      {
        "titulo": "Decreto 422 del Congreso del Estado de Durango (coordenadas de las PTAR Norte y Oriente)",
        "url": "https://congresodurango.gob.mx/Archivos/LXX/DECRETOS/DEC422.pdf"
      },
      {
        "titulo": "OpenStreetMap (© colaboradores, ODbL)",
        "url": "https://www.openstreetmap.org/"
      }
    ]
  },
  "obras": [
    {
      "id": "pf-vergel",
      "nombre": "Colector / avenida Vergel",
      "calle": "Avenida Vergel, tramo entre Ocampo y Constitución (Zona Centro)",
      "estado": "en ejecución",
      "geom": [
        [
          [
            -5088.2,
            1385.4
          ],
          [
            -5077.9,
            1404.8
          ],
          [
            -5067.7,
            1424.1
          ],
          [
            -5057.5,
            1443.4
          ],
          [
            -5047.2,
            1462.8
          ],
          [
            -5037.4,
            1481.8
          ],
          [
            -5027.9,
            1500.5
          ],
          [
            -5018.4,
            1519.2
          ],
          [
            -5008.9,
            1537.8
          ],
          [
            -4999.4,
            1556.5
          ],
          [
            -4990.0,
            1575.2
          ],
          [
            -4980.5,
            1593.9
          ],
          [
            -4971.0,
            1612.6
          ],
          [
            -4961.5,
            1631.3
          ],
          [
            -4952.1,
            1650.0
          ],
          [
            -4942.7,
            1668.3
          ],
          [
            -4933.4,
            1686.7
          ],
          [
            -4924.1,
            1705.0
          ],
          [
            -4914.7,
            1723.4
          ],
          [
            -4905.4,
            1741.7
          ],
          [
            -4895.7,
            1761.2
          ],
          [
            -4886.1,
            1780.7
          ],
          [
            -4876.4,
            1800.1
          ],
          [
            -4866.7,
            1819.6
          ],
          [
            -4857.2,
            1838.3
          ],
          [
            -4847.7,
            1856.4
          ],
          [
            -4838.2,
            1874.5
          ],
          [
            -4828.7,
            1892.5
          ],
          [
            -4819.2,
            1910.6
          ],
          [
            -4814.5,
            1919.6
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Colector Vergel (Zona Centro) — 24″, 1,100 m, obra ejecutada en el inventario de 24.8 MDP."
        },
        {
          "titulo": "Contexto de Durango, 21 jul 2026",
          "url": "https://contextodedurango.com.mx/plan-fluye-avanza-con-renovacion-del-drenaje-sanitario-en-el-centro-de-gomez-palacio/",
          "dato": "Reposición del colector de 24″ en calle Vergel, tramo Ocampo–Constitución; más de 703 m de PEAD y 8 pozos de visita; supervisión de SIDEAPA."
        }
      ],
      "nota": "El trazo se recorta a la avenida Vergel de OSM entre las calles Ocampo y Constitución.",
      "geometria": "OSM (Geofabrik 12-nov-2026), 600 m geocodificados (la nota de prensa indica >703 m; el dossier cita 1,100 m del colector).",
      "ll": [
        [
          [
            25.571851,
            -103.496993
          ],
          [
            25.571675,
            -103.496893
          ],
          [
            25.5715,
            -103.496793
          ],
          [
            25.571325,
            -103.496694
          ],
          [
            25.571149,
            -103.496594
          ],
          [
            25.570976,
            -103.496498
          ],
          [
            25.570806,
            -103.496406
          ],
          [
            25.570636,
            -103.496313
          ],
          [
            25.570468,
            -103.496221
          ],
          [
            25.570298,
            -103.496129
          ],
          [
            25.570128,
            -103.496037
          ],
          [
            25.569958,
            -103.495945
          ],
          [
            25.569788,
            -103.495852
          ],
          [
            25.569619,
            -103.49576
          ],
          [
            25.569449,
            -103.495668
          ],
          [
            25.569283,
            -103.495577
          ],
          [
            25.569116,
            -103.495486
          ],
          [
            25.56895,
            -103.495396
          ],
          [
            25.568782,
            -103.495304
          ],
          [
            25.568616,
            -103.495214
          ],
          [
            25.568439,
            -103.49512
          ],
          [
            25.568262,
            -103.495026
          ],
          [
            25.568086,
            -103.494932
          ],
          [
            25.567909,
            -103.494838
          ],
          [
            25.567739,
            -103.494745
          ],
          [
            25.567575,
            -103.494653
          ],
          [
            25.567411,
            -103.49456
          ],
          [
            25.567247,
            -103.494468
          ],
          [
            25.567083,
            -103.494375
          ],
          [
            25.567001,
            -103.494329
          ]
        ]
      ],
      "jerarquia": "colector"
    },
    {
      "id": "pf-san-alberto",
      "nombre": "Colector San Alberto",
      "calle": "Calle San Jesús, colonia San Ángel",
      "estado": "en obra (banderazo 23 jul 2026)",
      "geom": [
        [
          [
            -3543.5,
            -3818.7
          ],
          [
            -3542.1,
            -3813.2
          ],
          [
            -3545.8,
            -3777.8
          ],
          [
            -3548.4,
            -3765.4
          ],
          [
            -3556.5,
            -3739.8
          ],
          [
            -3562.0,
            -3722.4
          ],
          [
            -3567.6,
            -3704.9
          ],
          [
            -3578.4,
            -3666.4
          ],
          [
            -3592.5,
            -3629.2
          ],
          [
            -3606.3,
            -3587.5
          ],
          [
            -3619.2,
            -3548.3
          ],
          [
            -3632.6,
            -3507.9
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "Extra de la Laguna, 23 jul 2026",
          "url": "https://extradelalaguna.com/gomez-palacio/para-fortalecer-plan-fluye-arranca-rehabilitacion-de-colector-san-alberto/",
          "dato": "Primera etapa: 712 m de PEAD de 36″ sobre la calle San Jesús, colonia San Ángel; 8 MDP, Ramo 33. Beneficia Miravalle, San Alberto, San Ángel, Ejido Filadelfia y parte de Hamburgo."
        }
      ],
      "nota": "Solo se dibuja el tramo de la calle San Jesús presente en OSM; no se inventa el resto de los 712 m publicados.",
      "geometria": "OSM, 325 m geocodificados de 712 m publicados.",
      "ll": [
        [
          [
            25.618671,
            -103.481025
          ],
          [
            25.618621,
            -103.481012
          ],
          [
            25.618302,
            -103.481053
          ],
          [
            25.61819,
            -103.48108
          ],
          [
            25.61796,
            -103.481164
          ],
          [
            25.617804,
            -103.481221
          ],
          [
            25.617646,
            -103.481278
          ],
          [
            25.6173,
            -103.48139
          ],
          [
            25.616965,
            -103.481535
          ],
          [
            25.61659,
            -103.481677
          ],
          [
            25.616238,
            -103.48181
          ],
          [
            25.615875,
            -103.481948
          ]
        ]
      ],
      "jerarquia": "colector"
    },
    {
      "id": "pf-jaramillo",
      "nombre": "Reposición de atarjeas, colonia Rubén Jaramillo",
      "calle": "Emiliano Zapata, Lucio Cabañas, Genaro Vázquez, Che Guevara y Ricardo Flores Magón, entre Patoni y Urrea",
      "estado": "en obra",
      "geom": [
        [
          [
            -3911.8,
            2127.2
          ],
          [
            -3921.0,
            2109.0
          ],
          [
            -3930.2,
            2090.7
          ],
          [
            -3939.4,
            2072.5
          ],
          [
            -3948.5,
            2054.2
          ],
          [
            -3957.7,
            2036.0
          ],
          [
            -3966.9,
            2017.7
          ],
          [
            -3976.1,
            1999.5
          ],
          [
            -3985.2,
            1981.2
          ],
          [
            -3994.4,
            1963.0
          ],
          [
            -4003.7,
            1944.5
          ],
          [
            -4013.1,
            1925.6
          ],
          [
            -4022.6,
            1906.8
          ],
          [
            -4032.0,
            1888.0
          ],
          [
            -4041.4,
            1869.2
          ],
          [
            -4050.8,
            1850.4
          ],
          [
            -4060.2,
            1831.5
          ],
          [
            -4069.6,
            1812.7
          ],
          [
            -4079.1,
            1793.9
          ],
          [
            -4088.5,
            1775.1
          ]
        ],
        [
          [
            -4117.6,
            1789.8
          ],
          [
            -4108.5,
            1807.7
          ],
          [
            -4099.4,
            1825.5
          ],
          [
            -4090.2,
            1843.3
          ],
          [
            -4081.1,
            1861.1
          ],
          [
            -4072.0,
            1879.0
          ],
          [
            -4062.8,
            1896.8
          ],
          [
            -4053.7,
            1914.6
          ],
          [
            -4044.6,
            1932.5
          ],
          [
            -4035.4,
            1950.3
          ],
          [
            -4026.3,
            1968.1
          ],
          [
            -4017.2,
            1986.5
          ],
          [
            -4008.1,
            2004.8
          ],
          [
            -3999.1,
            2023.1
          ],
          [
            -3990.0,
            2041.5
          ],
          [
            -3980.9,
            2059.8
          ],
          [
            -3971.8,
            2078.1
          ],
          [
            -3962.8,
            2096.5
          ],
          [
            -3953.7,
            2114.8
          ],
          [
            -3944.6,
            2133.1
          ],
          [
            -3940.1,
            2142.3
          ]
        ],
        [
          [
            -3967.9,
            2156.8
          ],
          [
            -3976.9,
            2138.5
          ],
          [
            -3986.0,
            2120.2
          ],
          [
            -3995.1,
            2102.0
          ],
          [
            -4004.1,
            2083.7
          ],
          [
            -4013.2,
            2065.4
          ],
          [
            -4022.3,
            2047.1
          ],
          [
            -4031.4,
            2028.9
          ],
          [
            -4040.4,
            2010.6
          ],
          [
            -4049.5,
            1992.3
          ],
          [
            -4058.6,
            1974.2
          ],
          [
            -4067.6,
            1956.2
          ],
          [
            -4076.6,
            1938.2
          ],
          [
            -4085.7,
            1920.3
          ],
          [
            -4094.7,
            1902.3
          ],
          [
            -4103.7,
            1884.3
          ],
          [
            -4112.8,
            1866.3
          ],
          [
            -4121.8,
            1848.4
          ],
          [
            -4130.9,
            1830.4
          ],
          [
            -4139.9,
            1812.4
          ],
          [
            -4144.4,
            1803.4
          ]
        ],
        [
          [
            -3995.8,
            2170.9
          ],
          [
            -4005.0,
            2152.6
          ],
          [
            -4014.2,
            2134.2
          ],
          [
            -4023.4,
            2115.9
          ],
          [
            -4032.6,
            2097.5
          ],
          [
            -4041.8,
            2079.1
          ],
          [
            -4051.0,
            2060.8
          ],
          [
            -4060.2,
            2042.4
          ],
          [
            -4069.4,
            2024.0
          ],
          [
            -4078.6,
            2005.7
          ],
          [
            -4088.0,
            1987.1
          ],
          [
            -4097.5,
            1968.3
          ],
          [
            -4107.0,
            1949.5
          ],
          [
            -4116.4,
            1930.7
          ],
          [
            -4125.9,
            1912.0
          ],
          [
            -4135.4,
            1893.2
          ],
          [
            -4144.9,
            1874.4
          ],
          [
            -4154.4,
            1855.6
          ],
          [
            -4163.9,
            1836.8
          ],
          [
            -4173.4,
            1818.0
          ]
        ],
        [
          [
            -4256.6,
            1860.2
          ],
          [
            -4247.7,
            1878.3
          ],
          [
            -4238.8,
            1896.4
          ],
          [
            -4229.8,
            1914.4
          ],
          [
            -4220.9,
            1932.5
          ],
          [
            -4212.0,
            1950.6
          ],
          [
            -4203.1,
            1968.7
          ],
          [
            -4194.2,
            1986.7
          ],
          [
            -4185.3,
            2004.8
          ],
          [
            -4176.3,
            2022.9
          ],
          [
            -4167.4,
            2041.0
          ],
          [
            -4158.3,
            2059.2
          ],
          [
            -4149.1,
            2077.4
          ],
          [
            -4140.0,
            2095.5
          ],
          [
            -4130.8,
            2113.7
          ],
          [
            -4121.6,
            2131.9
          ],
          [
            -4112.5,
            2150.1
          ],
          [
            -4103.3,
            2168.3
          ],
          [
            -4094.2,
            2186.5
          ],
          [
            -4085.0,
            2204.7
          ],
          [
            -4080.5,
            2213.8
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "35 Milímetros",
          "url": "https://periodico35mm.com/transforma-plan-fluye-la-infraestructura-sanitaria-de-la-colonia-ruben-jaramillo-con-5-6-mdp/",
          "dato": "5.6 MDP (Ramo 33): ~2,000 m de PEAD de 8″ en esas cinco calles, entre Patoni y Urrea, y 1,110 m de 6″ para 370 descargas domiciliarias."
        }
      ],
      "nota": "Cada calle se recorta en OSM al tramo entre Patoni y Urrea, como indica la fuente.",
      "geometria": "OSM, 1974 m en 5 calles (la fuente cita cerca de 2,000 m).",
      "ll": [
        [
          [
            25.565034,
            -103.485369
          ],
          [
            25.5652,
            -103.485458
          ],
          [
            25.565366,
            -103.485548
          ],
          [
            25.565531,
            -103.485637
          ],
          [
            25.565697,
            -103.485726
          ],
          [
            25.565862,
            -103.485815
          ],
          [
            25.566028,
            -103.485905
          ],
          [
            25.566194,
            -103.485994
          ],
          [
            25.56636,
            -103.486083
          ],
          [
            25.566525,
            -103.486172
          ],
          [
            25.566693,
            -103.486263
          ],
          [
            25.566865,
            -103.486354
          ],
          [
            25.567035,
            -103.486446
          ],
          [
            25.567206,
            -103.486538
          ],
          [
            25.567377,
            -103.486629
          ],
          [
            25.567547,
            -103.486721
          ],
          [
            25.567719,
            -103.486812
          ],
          [
            25.56789,
            -103.486903
          ],
          [
            25.56806,
            -103.486996
          ],
          [
            25.568231,
            -103.487087
          ]
        ],
        [
          [
            25.568101,
            -103.487379
          ],
          [
            25.567939,
            -103.48729
          ],
          [
            25.567777,
            -103.487202
          ],
          [
            25.567615,
            -103.487112
          ],
          [
            25.567454,
            -103.487023
          ],
          [
            25.567291,
            -103.486935
          ],
          [
            25.56713,
            -103.486845
          ],
          [
            25.566968,
            -103.486757
          ],
          [
            25.566806,
            -103.486668
          ],
          [
            25.566644,
            -103.486579
          ],
          [
            25.566482,
            -103.48649
          ],
          [
            25.566315,
            -103.486402
          ],
          [
            25.566149,
            -103.486313
          ],
          [
            25.565983,
            -103.486226
          ],
          [
            25.565816,
            -103.486137
          ],
          [
            25.56565,
            -103.486049
          ],
          [
            25.565484,
            -103.48596
          ],
          [
            25.565317,
            -103.485873
          ],
          [
            25.565151,
            -103.485784
          ],
          [
            25.564984,
            -103.485696
          ],
          [
            25.564901,
            -103.485652
          ]
        ],
        [
          [
            25.564773,
            -103.48593
          ],
          [
            25.564939,
            -103.486018
          ],
          [
            25.565105,
            -103.486106
          ],
          [
            25.56527,
            -103.486195
          ],
          [
            25.565436,
            -103.486282
          ],
          [
            25.565603,
            -103.486371
          ],
          [
            25.565769,
            -103.486459
          ],
          [
            25.565934,
            -103.486548
          ],
          [
            25.5661,
            -103.486635
          ],
          [
            25.566266,
            -103.486724
          ],
          [
            25.566431,
            -103.486812
          ],
          [
            25.566594,
            -103.4869
          ],
          [
            25.566757,
            -103.486987
          ],
          [
            25.56692,
            -103.487076
          ],
          [
            25.567083,
            -103.487163
          ],
          [
            25.567247,
            -103.487251
          ],
          [
            25.56741,
            -103.48734
          ],
          [
            25.567573,
            -103.487427
          ],
          [
            25.567736,
            -103.487516
          ],
          [
            25.5679,
            -103.487603
          ],
          [
            25.567981,
            -103.487647
          ]
        ],
        [
          [
            25.564648,
            -103.48621
          ],
          [
            25.564815,
            -103.486299
          ],
          [
            25.564982,
            -103.486389
          ],
          [
            25.565148,
            -103.486478
          ],
          [
            25.565315,
            -103.486568
          ],
          [
            25.565482,
            -103.486657
          ],
          [
            25.565648,
            -103.486747
          ],
          [
            25.565815,
            -103.486836
          ],
          [
            25.565982,
            -103.486925
          ],
          [
            25.566148,
            -103.487015
          ],
          [
            25.566317,
            -103.487106
          ],
          [
            25.566488,
            -103.487199
          ],
          [
            25.566659,
            -103.487291
          ],
          [
            25.566829,
            -103.487383
          ],
          [
            25.566999,
            -103.487475
          ],
          [
            25.56717,
            -103.487568
          ],
          [
            25.56734,
            -103.48766
          ],
          [
            25.567511,
            -103.487752
          ],
          [
            25.567682,
            -103.487845
          ],
          [
            25.567852,
            -103.487937
          ]
        ],
        [
          [
            25.56748,
            -103.48877
          ],
          [
            25.567316,
            -103.488683
          ],
          [
            25.567151,
            -103.488597
          ],
          [
            25.566988,
            -103.488509
          ],
          [
            25.566824,
            -103.488423
          ],
          [
            25.566659,
            -103.488336
          ],
          [
            25.566495,
            -103.48825
          ],
          [
            25.566332,
            -103.488163
          ],
          [
            25.566167,
            -103.488077
          ],
          [
            25.566003,
            -103.487989
          ],
          [
            25.565839,
            -103.487903
          ],
          [
            25.565673,
            -103.487814
          ],
          [
            25.565508,
            -103.487725
          ],
          [
            25.565344,
            -103.487636
          ],
          [
            25.565179,
            -103.487547
          ],
          [
            25.565013,
            -103.487457
          ],
          [
            25.564848,
            -103.487369
          ],
          [
            25.564683,
            -103.487279
          ],
          [
            25.564518,
            -103.487191
          ],
          [
            25.564352,
            -103.487101
          ],
          [
            25.56427,
            -103.487057
          ]
        ]
      ],
      "jerarquia": "atarjea",
      "diametro_cm": 20
    },
    {
      "id": "pf-arista",
      "nombre": "Subcolector en calle Mariano Arista",
      "calle": "Avenida General Mariano Arista / Avenida Arista, colonia 5 de Mayo",
      "estado": "ejecutada (inventario del Plan Fluye, abr 2026)",
      "geom": [
        [
          [
            -3880.2,
            743.1
          ],
          [
            -3848.4,
            808.8
          ],
          [
            -3816.7,
            870.9
          ],
          [
            -3785.1,
            938.3
          ],
          [
            -3752.1,
            1002.8
          ],
          [
            -3721.4,
            1064.9
          ],
          [
            -3687.3,
            1134.1
          ],
          [
            -3651.8,
            1201.1
          ],
          [
            -3620.7,
            1263.6
          ],
          [
            -3580.8,
            1355.2
          ]
        ],
        [
          [
            -3943.0,
            612.6
          ],
          [
            -3912.8,
            677.0
          ],
          [
            -3880.2,
            743.1
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Sustitución y construcción de subcolectores: Calle Mariano Arista — Col. 5 de Mayo."
        }
      ],
      "nota": "Se dibuja la calle de OSM con ese nombre en Gómez Palacio. El dossier no publica el kilometraje ni las esquinas del tramo.",
      "geometria": "OSM, 826 m de la calle (tramo exacto no acotado en la fuente).",
      "ll": [
        [
          [
            25.577526,
            -103.484897
          ],
          [
            25.576929,
            -103.484588
          ],
          [
            25.576365,
            -103.484279
          ],
          [
            25.575754,
            -103.483973
          ],
          [
            25.575168,
            -103.483651
          ],
          [
            25.574604,
            -103.483353
          ],
          [
            25.573976,
            -103.483021
          ],
          [
            25.573368,
            -103.482676
          ],
          [
            25.5728,
            -103.482373
          ],
          [
            25.571969,
            -103.481987
          ]
        ],
        [
          [
            25.57871,
            -103.485507
          ],
          [
            25.578126,
            -103.485214
          ],
          [
            25.577526,
            -103.484897
          ]
        ]
      ],
      "jerarquia": "subcolector"
    },
    {
      "id": "pf-herradura",
      "nombre": "Subcolector en colonia La Herradura",
      "calle": "Calle Rosal, de avenida Madero a su conexión con el colector de avenida Hidalgo",
      "estado": "en obra (arranque 28 oct 2026)",
      "geom": [
        [
          [
            -6101.7,
            416.2
          ],
          [
            -6083.8,
            407.2
          ],
          [
            -6065.8,
            398.2
          ],
          [
            -6047.9,
            389.2
          ],
          [
            -6029.9,
            380.2
          ],
          [
            -6012.0,
            371.2
          ],
          [
            -5993.9,
            362.1
          ],
          [
            -5975.9,
            353.0
          ],
          [
            -5957.9,
            343.9
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "La Neta Laguna, 28 oct 2026",
          "url": "https://lanetalaguna.com/2026/10/28/rehabilitan-subcolector-de-drenaje-en-la-herradura-beneficiara-a-mil-500-habitantes/",
          "dato": "Reposición de 600 m de PEAD sobre la calle Rosal, desde avenida Madero hasta el colector de avenida Hidalgo; ~1,500 habitantes."
        },
        {
          "titulo": "Contexto de Durango",
          "url": "https://contextodedurango.com.mx/plan-fluye-suma-obras-para-renovar-el-drenaje-de-gomez-palacio/",
          "dato": "Misma obra, incluida en el Plan Fluye."
        }
      ],
      "nota": "Geometría: calle Rosal de OSM. Si el recorte entre Madero e Hidalgo no cierra del todo, se usa el tramo de OSM y se declara la diferencia con los 600 m publicados.",
      "geometria": "OSM, 161 m geocodificados (la fuente publica 600 m).",
      "ll": [
        [
          [
            25.580704,
            -103.506972
          ],
          [
            25.580783,
            -103.506793
          ],
          [
            25.580863,
            -103.506613
          ],
          [
            25.580942,
            -103.506433
          ],
          [
            25.581022,
            -103.506253
          ],
          [
            25.581101,
            -103.506074
          ],
          [
            25.581181,
            -103.505893
          ],
          [
            25.581262,
            -103.505713
          ],
          [
            25.581342,
            -103.505532
          ]
        ]
      ],
      "jerarquia": "subcolector"
    },
    {
      "id": "pf-la-feria-ruleta",
      "nombre": "Subcolector en Fraccionamiento La Feria — calle De la Ruleta",
      "calle": "Calle la Ruleta (OSM)",
      "estado": "ejecutada (inventario del Plan Fluye, abr 2026)",
      "geom": [
        [
          [
            -2902.9,
            411.7
          ],
          [
            -2837.8,
            536.4
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Fraccionamiento La Feria — calle De la Ruleta y Oceanía."
        }
      ],
      "nota": "Solo aparece la calle la Ruleta, presente en OSM dentro de Gómez Palacio. Calle Oceanía no está en el extracto OSM de esta zona; no se inventa su trazo.",
      "geometria": "OSM, 141 m.",
      "ll": [
        [
          [
            25.580416,
            -103.475132
          ],
          [
            25.579284,
            -103.474498
          ]
        ]
      ],
      "jerarquia": "subcolector"
    },
    {
      "id": "pf-emisor-si",
      "nombre": "Emisor Central y colector San Ignacio (1.ª etapa)",
      "calle": "Trazo de la 1.ª etapa del contrato CAED-IPE-082-26 (ya en el visor)",
      "estado": "en obra (contrato; inicio 9 nov 2026, 180 días)",
      "geom": [],
      "usar_zanja_visor": true,
      "fuente": [
        {
          "titulo": "CompraNet Durango, LP/E/CAED/008/2026",
          "url": "https://comprasestatal.durango.gob.mx/consulta/ProcedimientosDeContratacion/10416",
          "dato": "Tramos y diámetros de la 1.ª etapa."
        },
        {
          "titulo": "El Siglo de Torreón, 2 nov 2026",
          "url": "https://www.elsiglodetorreon.com.mx/noticia/2026/anuncian-empresa-que-iniciara-obra-de-emisor-sanitario-en-gomez-palacio-van-mas-de-188mdp.html",
          "dato": "Contrato 188.27 MDP con IVA, inicio 9 de noviembre, 180 días naturales."
        },
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "El emisor es la pieza central del Plan Fluye."
        },
        {
          "titulo": "Milenio, 26 oct 2026",
          "url": "https://www.milenio.com/estados/presentan-avances-plan-fluye-gomez-palacio",
          "dato": "13.27 km en total, ≈80 % del agua residual, material PRFV."
        }
      ],
      "nota": "Se reutiliza la geometría ya cargada en el visor (trazo de diseño preliminar sobre el contrato, no el proyecto ejecutivo).",
      "geometria": "Geometría existente del visor (zanja / capa de gobierno).",
      "jerarquia": "emisor"
    },
    {
      "id": "pf-santa-rosa",
      "nombre": "Subcolectores en Ampliación Santa Rosa — andadores Brasil y Colombia",
      "calle": "Calle Brasil y Andador Colombia (OSM), C.P. 35068",
      "estado": "ejecutada (inventario del Plan Fluye, abr 2026)",
      "jerarquia": "subcolector",
      "geom": [
        [
          [
            -3976.0,
            2323.1
          ],
          [
            -3924.2,
            2299.7
          ],
          [
            -3914.4,
            2295.3
          ],
          [
            -3906.9,
            2291.6
          ],
          [
            -3885.5,
            2280.9
          ],
          [
            -3860.8,
            2268.5
          ],
          [
            -3842.7,
            2259.5
          ],
          [
            -3777.7,
            2226.7
          ],
          [
            -3769.9,
            2222.7
          ],
          [
            -3719.5,
            2197.4
          ],
          [
            -3694.8,
            2184.9
          ],
          [
            -3635.5,
            2155.0
          ]
        ],
        [
          [
            -3636.5,
            2198.7
          ],
          [
            -3676.1,
            2218.0
          ],
          [
            -3695.6,
            2227.5
          ],
          [
            -3702.6,
            2231.2
          ],
          [
            -3749.3,
            2255.5
          ],
          [
            -3759.9,
            2261.1
          ],
          [
            -3770.6,
            2266.2
          ],
          [
            -3844.5,
            2301.9
          ],
          [
            -3868.8,
            2313.6
          ],
          [
            -3893.0,
            2325.2
          ],
          [
            -3898.3,
            2327.7
          ],
          [
            -3907.8,
            2332.1
          ],
          [
            -3978.3,
            2364.0
          ]
        ]
      ],
      "ll": [
        [
          [
            25.563273,
            -103.48603
          ],
          [
            25.563478,
            -103.485511
          ],
          [
            25.563517,
            -103.485414
          ],
          [
            25.56355,
            -103.485339
          ],
          [
            25.563644,
            -103.485124
          ],
          [
            25.563753,
            -103.484877
          ],
          [
            25.563833,
            -103.484696
          ],
          [
            25.564122,
            -103.484045
          ],
          [
            25.564157,
            -103.483967
          ],
          [
            25.564381,
            -103.483463
          ],
          [
            25.564491,
            -103.483216
          ],
          [
            25.564755,
            -103.482622
          ]
        ],
        [
          [
            25.56436,
            -103.482637
          ],
          [
            25.56419,
            -103.483033
          ],
          [
            25.564106,
            -103.483229
          ],
          [
            25.564074,
            -103.483299
          ],
          [
            25.563859,
            -103.483766
          ],
          [
            25.56381,
            -103.483872
          ],
          [
            25.563765,
            -103.483979
          ],
          [
            25.563451,
            -103.484719
          ],
          [
            25.563347,
            -103.484962
          ],
          [
            25.563245,
            -103.485204
          ],
          [
            25.563222,
            -103.485257
          ],
          [
            25.563184,
            -103.485352
          ],
          [
            25.562904,
            -103.486057
          ]
        ]
      ],
      "fuente": [
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Sustitución y construcción de subcolectores: Ampliación Santa Rosa — Andadores Brasil y Colombia."
        },
        {
          "titulo": "OpenStreetMap",
          "url": "https://www.openstreetmap.org/",
          "dato": "Geometría de Calle Brasil (vía 853501919) y Andador Colombia (vía 226443837), © OpenStreetMap contributors (ODbL)."
        }
      ],
      "nota": "Ampliación Santa Rosa no aparece como lugar en OSM. Se dibujan solo las dos vías que nombra el plan, que corren paralelas en el C.P. 35068. En OSM una se llama Calle Brasil y la otra Andador Colombia.",
      "geometria": "OSM, dos vías geocodificadas."
    }
  ],
  "puntos": [
    {
      "id": "pf-ptar-norte",
      "nombre": "PTAR Norte «J. Guadalupe Rodríguez»",
      "tipo": "ptar",
      "lat": 25.640389,
      "lon": -103.471833,
      "dms": "25°38'25.4\" N, 103°28'18.6\" W",
      "sitio": "Ejido J. Guadalupe Rodríguez",
      "estado": "Existente; el Plan Fluye prevé su ampliación",
      "detalle": "Destino del Emisor Central. Tecnología de lagunas de estabilización. Capacidad efectiva actual reducida a menos de 500 L/s. El plan prevé un nuevo módulo de 250 L/s, rehabilitación de lo existente y 750 L/s totales. Inversión requerida: 500 MDP, plazo 12 meses. El trazo del Emisor Central y del colector San Ignacio no se dibuja: no hay plano público de SIDEAPA.",
      "fuente": [
        {
          "titulo": "Decreto 422 del Congreso del Estado de Durango",
          "url": "https://congresodurango.gob.mx/Archivos/LXX/DECRETOS/DEC422.pdf",
          "dato": "Coordenadas oficiales de la PTAR Norte en el ejido J. Guadalupe Rodríguez: 25°38'25.4\" N, 103°28'18.6\" W."
        },
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Ampliación: nuevo módulo de 250 L/s, capacidad proyectada 750 L/s, 500 MDP."
        }
      ]
    },
    {
      "id": "pf-ptar-oriente",
      "nombre": "PTAR Oriente",
      "tipo": "ptar",
      "lat": 25.613167,
      "lon": -103.437528,
      "dms": "25°36'47.4\" N, 103°26'15.1\" W",
      "sitio": "Ejido Las Huertas",
      "estado": "Existente; el Plan Fluye prevé modernización integral",
      "detalle": "Tecnología de lodos activados. El plan prevé sustituir la planta actual e incrementar la capacidad a 250 L/s, con tratamiento especializado para cargas industriales (DQO, DBO, metales, grasas). Esa cifra es la capacidad proyectada, no un caudal medido hoy.",
      "fuente": [
        {
          "titulo": "Decreto 422 del Congreso del Estado de Durango",
          "url": "https://congresodurango.gob.mx/Archivos/LXX/DECRETOS/DEC422.pdf",
          "dato": "Coordenadas oficiales de la PTAR Oriente en el ejido Las Huertas: 25°36'47.4\" N, 103°26'15.1\" W."
        },
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Modernización integral; capacidad proyectada 250 L/s."
        }
      ]
    },
    {
      "id": "pf-mercado-abastos",
      "nombre": "Mercado de Abastos (inmediaciones del colector)",
      "tipo": "mercado",
      "lat": 25.567176,
      "lon": -103.478795,
      "poly": [
        [
          25.565477,
          -103.480918
        ],
        [
          25.564074,
          -103.478257
        ],
        [
          25.568874,
          -103.476659
        ],
        [
          25.569738,
          -103.479532
        ],
        [
          25.565477,
          -103.480918
        ]
      ],
      "estado": "Colector en construcción (boletín 27 oct 2026)",
      "detalle": "El boletín municipal informa un colector en las inmediaciones del Mercado de Abastos, con 11 MDP (mezcla estatal y federal). Se marca el predio del mercado en OSM; el trazo del colector no está publicado.",
      "fuente": [
        {
          "titulo": "Ayuntamiento de Gómez Palacio, boletín 27 de octubre de 2026",
          "url": "https://www.gomezpalacio.gob.mx/",
          "dato": "Inversión de 11 millones de pesos, mediante una mezcla de recursos estatales y federales, para el colector que se construye en las inmediaciones del Mercado de Abastos."
        },
        {
          "titulo": "OpenStreetMap",
          "url": "https://www.openstreetmap.org/way/116783567",
          "dato": "Predio «Central de abastos M. Rebollo Acosta» (landuse=commercial), © OpenStreetMap contributors (ODbL). Dirección pública del mercado: Blvd. Rebollo Acosta esquina con Carlos Herrera, C.P. 35069."
        }
      ]
    },
    {
      "id": "pf-casa-blanca",
      "nombre": "Colonia Casa Blanca (referencia del colector Solidaridad)",
      "tipo": "colonia",
      "lat": 25.622305,
      "lon": -103.506292,
      "poly": [
        [
          25.622289,
          -103.507643
        ],
        [
          25.621312,
          -103.505492
        ],
        [
          25.62232,
          -103.504941
        ],
        [
          25.623308,
          -103.507052
        ],
        [
          25.622289,
          -103.507643
        ]
      ],
      "estado": "Obra ejecutada (inventario del Plan Fluye, abr 2026)",
      "detalle": "El plan lista el colector Solidaridad (Casa Blanca) de 24 pulgadas, sin calle ni kilometraje. Se marca el conjunto habitacional Casa Blanca (OSM, Infonavit, C.P. 35016), no el trazo del tubo.",
      "fuente": [
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Reposición y rehabilitación: Colector Solidaridad (Casa Blanca) — 24\"."
        },
        {
          "titulo": "OpenStreetMap",
          "url": "https://www.openstreetmap.org/way/1573510223",
          "dato": "Área residencial «Casa Blanca», operator=Infonavit, © OpenStreetMap contributors (ODbL)."
        }
      ]
    },
    {
      "id": "pf-hamburgo",
      "nombre": "Colonia Residencial Hamburgo (referencia del bombeo pluvial)",
      "tipo": "colonia",
      "lat": 25.594984,
      "lon": -103.497057,
      "estado": "Obra ejecutada (inventario del Plan Fluye, abr 2026)",
      "detalle": "El plan lista bombeo pluvial en la colonia Hamburgo, sin un punto del cárcamo. Se marca Plaza Hamburgo (OSM; vecindario Residencial Hamburgo, Av. Francisco Villa, C.P. 35018) solo como referencia de la colonia.",
      "fuente": [
        {
          "titulo": "Gobierno de Gómez Palacio, Plan Fluye (dossier, abril 2026)",
          "url": "https://www.gomezpalacio.gob.mx/wp-content/uploads/2026/04/plan-fluye.pdf",
          "dato": "Sistema pluvial: Colonia Hamburgo — bombeo pluvial."
        },
        {
          "titulo": "OpenStreetMap",
          "url": "https://www.openstreetmap.org/way/483612657",
          "dato": "Plaza Hamburgo, object:neighbourhood=Residencial Hamburgo, © OpenStreetMap contributors (ODbL)."
        }
      ]
    }
  ],
  "solo_listado": [
    {
      "id": "pf-emisor-si-listado",
      "nombre": "Emisor Central y colector San Ignacio (sustitución integral)",
      "detalle": "Sustitución de 13.27 km con poliéster reforzado con fibra de vidrio (72 pulgadas el emisor, 60 pulgadas San Ignacio). El emisor proyectado mide 1.83 m de diámetro y conduce las aguas residuales a la PTAR Norte. Juntos transportan cerca del 80 % de las aguas residuales y dan servicio a unos 262 mil habitantes. Inversión requerida: 570 MDP (cifra del plan firmado en abril de 2026; el boletín del 27 de octubre menciona 575 MDP). En el mapa solo se marca el destino (PTAR Norte). El trazo no se dibuja: no hay plano público de SIDEAPA.",
      "estado": "En proceso de licitación / contrato de la primera etapa a cargo de Conagua y la CAED",
      "fuente": "Plan Fluye, abril 2026; boletín del Ayuntamiento, 27 oct 2026; CompraNet CAED-IPE-082-26"
    },
    {
      "id": "pf-madero",
      "nombre": "Subcolectores en Calle Madero — 2 tramos, Col. Centro",
      "detalle": "El plan no publica las esquinas de los dos tramos. No se dibuja la avenida completa.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-oceania",
      "nombre": "Subcolector en Fraccionamiento La Feria — calle Oceanía",
      "detalle": "El plan la nombra junto con De la Ruleta. Calle Oceanía no está en el extracto OSM de esa zona; no se inventa su trazo. De la Ruleta sí está en el mapa.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-pedregal-zarco",
      "nombre": "Rehabilitación de líneas en Rincón del Pedregal y Col. Francisco Zarco",
      "detalle": "El plan no publica calle ni kilometraje. Rincón del Pedregal no aparece como lugar en OSM. Francisco Zarco es nombre de varias calles, no una colonia unívoca.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-carcamo-urbivillas",
      "nombre": "Cárcamo sanitario en Urbivillas",
      "detalle": "Urbivillas no aparece como lugar en OSM. Sin coordenada del cárcamo.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-carcamos-vergel-refugio",
      "nombre": "Interconexión de cárcamos El Vergel y El Refugio",
      "detalle": "Hay un poblado El Vergel al norte (C.P. 35120) y la avenida Vergel en el centro; El Refugio también es un nombre repetido. Sin un punto unívoco no se marca.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-pluvial-morelos",
      "nombre": "Sistema pluvial Fracc. Morelos I — red de gravedad, cárcamo y línea de presión",
      "detalle": "No hay un fraccionamiento Morelos I en OSM (sí hay avenida José María Morelos en el Centro). Sin trazo publicado.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-pluvial-urbivillas",
      "nombre": "Sistema pluvial Urbivillas — 1.ª y 2.ª etapa",
      "detalle": "Urbivillas no aparece como lugar en OSM. Sin trazo publicado.",
      "estado": "Ejecutada (inventario, abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    },
    {
      "id": "pf-ramo33",
      "nombre": "Programa Ramo 33 — 84.5 MDP",
      "detalle": "Rehabilitación de colectores y subcolectores de 18, 24 y 36 pulgadas en las colonias Centro, Bellavista, Santa Rosa, San Ángel, Filadelfia, El Dorado, Valle Campestre, Revolución y La Herradura. Plazo de 3 a 8 meses. Solo se dibujan los tramos con calle publicada (por ejemplo Calle Rosal en La Herradura y Calle San Jesús en San Ángel).",
      "estado": "En proceso (abr 2026)",
      "fuente": "Plan Fluye, abril 2026"
    }
  ]
};
