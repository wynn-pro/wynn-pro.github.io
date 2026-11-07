// Jungle Jam levels: 36 puzzles, made and checked by a computer solver.
// Each grid is the 6x6 board read left to right, top to bottom (6 letters per row).
// A = Mango's banana cart, other letters = logs and stone pillars, . = empty ground.
// par = the fewest moves that solve the puzzle.
const LEVELS = [
  { grid: "...........BC..AABCD....CD..........", par: 2 }, // Riverbank
  { grid: "....DD.........AAC.B...C.B...C......", par: 2 },
  { grid: "....D....CD.AA.CB.....B.............", par: 3 },
  { grid: "..........BC.AA.BC.............DD...", par: 3 },
  { grid: "...D....ED..AAED.........B.CC..B....", par: 4 },
  { grid: "..E.....ECC.AAEB.D...B.D...B....FF..", par: 5 },
  { grid: "....D.....D..AA.C..FF.C...EBB...E...", par: 6 },
  { grid: ".DDECC...EG...AAGB.....B....F.....F.", par: 7 },
  { grid: ".DDECC...EG...AAGB.....B....F.....F.", par: 7 },
  { grid: "BB......DDF...AAF.....F....HGG.EEHCC", par: 8 },
  { grid: "....E.....EFDIAAGFDI.HG...CHBB..C...", par: 9 },
  { grid: ".E.....EDDBBAAH...CCH.G.FFF.G.......", par: 10 },
  { grid: "..HHHG...E.G.AAE.D...BBD..CIFF..CI..", par: 11 }, // Deep Jungle
  { grid: "EDDGHHEBBG.LE.AAJLFFCCJI..M..I..M.KK", par: 13 },
  { grid: ".GG..EIICCCEKAA.B.K..FB.K.JFHHDDJ...", par: 14 },
  { grid: "JJLLC.G.KKCEGAADCE...DHHF.BBBNFMMIIN", par: 15 },
  { grid: "FF.IILHHCCCLAAKMD.B.KMDJBNN.DJBGG.EE", par: 16 },
  { grid: ".NNJJIMMCCCIAALEG.B.LEGKBDD.GKBHH.FF", par: 17 },
  { grid: "JJ.FFGKKBBBGCAAHLDC..HLDC.M.NNEEM.II", par: 18 },
  { grid: "G.NNIIG.HHEJM.AAEJMFFDDCBBBK.CLL.K..", par: 20 },
  { grid: "JJFFFKLLGGGKDAA.MID...MID.BCNNEEBCHH", par: 21 },
  { grid: ".KGGII.K.MLLAAHM.CB.H.ECB.JJECBFFDDD", par: 22 },
  { grid: "HCCJJGHNNIKGAAEIK...EILL....MFDDBBMF", par: 23 },
  { grid: "FFNN.H.JJJBH..AABDEEKCBDI.KCGGI.MMLL", par: 25 },
  { grid: "ILLDEEIGGDFMIAA.FM..NCCM..NJKKBBBJHH", par: 26 }, // Lost Temple
  { grid: "K.MMFFK.ECCLAAEG.LIJ.GNNIJBBH..DD.H.", par: 27 },
  { grid: "JJBBBHGGDDKH..AAKC..LIICN.LEFFNMME..", par: 28 },
  { grid: "KHHCF.K..CFEAAM.FE.IMDDD.IBBBJLL.GGJ", par: 29 },
  { grid: "MEEK..MHCKLL.HCAAIGGN.BI..N.BJFFDDBJ", par: 29 },
  { grid: "MEEK..MHCKLL.HCAAIGGN.BI..N.BJFFDDBJ", par: 29 },
  { grid: "H.BBIIH.JJELAAMGELDDMGNN..FFFC.KKK.C", par: 30 },
  { grid: "C.HKKKC.HDDDBAAN.IBJ.NLIBJGGLEFFMM.E", par: 32 },
  { grid: "F.BBMMF....JAAD..JHHDIICLLLEGC.KKEG.", par: 33 },
  { grid: "F.BBMMF....JAAD..JHHDIICLLLEGC.KKEG.", par: 33 },
  { grid: "BCCLGGBDDLI.BAAMINJJHMIN..HKKN.FFEE.", par: 34 },
  { grid: "BCCLGGBDDLI.BAAMINJJHMIN..HKKN.FFEE.", par: 34 },
];
