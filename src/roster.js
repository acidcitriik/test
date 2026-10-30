// Seven distinct opponents, in the official SYNTHPUCK Arcade order.
// The four stat bars are art-direction attributes, independent of difficulty.
// aiSpeed and aiAcceleration drive the existing original tactical physics AI.
export const ROSTER=Object.freeze([
 {id:'mute',name:'MUTE',epithet:'LA SILENCIEUSE',arena:'USS SULACO',bio:'Observe, anticipe et défend sans un mot.',stats:[4,4,3,4],aiSpeed:3.1,aiAcceleration:17,style:'guard',accent:'#ffd16b'},
 {id:'chonk',name:'CHONK',epithet:'LE COLOSSE',arena:'INFERNO',bio:'Puissant, obstiné, débordant d’énergie.',stats:[4,4,4,3],aiSpeed:3.8,aiAcceleration:25,style:'bruiser',accent:'#ff9c42'},
 {id:'simous',name:'SIMOUS',epithet:'LE VOYAGEUR',arena:'SALOON 1885',bio:'Un joueur de bandes aussi rusé que distrait.',stats:[2,3,2,3],aiSpeed:4.5,aiAcceleration:28,style:'banker',accent:'#ffc487'},
 {id:'mamouda',name:'MAMOUDA',epithet:'LE FONCEUR',arena:'CAPSULE BAR',bio:'Vif, provocateur, toujours à l’attaque.',stats:[4,4,5,3],aiSpeed:5.2,aiAcceleration:34,style:'rush',accent:'#ff5069'},
 {id:'diamond',name:'DIAMOND',epithet:'L’EXCENTRIQUE',arena:'FHLOSTON PARADISE',bio:'Du spectacle, des angles et des feintes.',stats:[3,3,3,4],aiSpeed:5.7,aiAcceleration:39,style:'showboat',accent:'#bf86ff'},
 {id:'stal',name:'STAL',epithet:'LE LOSER',arena:'NEBUCHADNEZZAR',bio:'Il rate tout… sauf lorsqu’on s’y attend le moins.',stats:[2,2,2,2],aiSpeed:6.35,aiAcceleration:43,style:'erratic',accent:'#99dbbc'},
 {id:'2502',name:'HAL',epithet:'L’ŒIL QUI VOIT TOUT',arena:'RED CORE',bio:'Son regard suit chaque trajectoire. La salle entière est son corps.',stats:[5,5,4,1],aiSpeed:6.9,aiAcceleration:49,style:'adaptive',accent:'#ff4a52'}
]);
export const STAT_NAMES=['TECHNIQUE','DÉFENSE','ATTAQUE','IMPRÉVISIBILITÉ'];
export const CHARACTER_INDEX=Object.freeze(Object.fromEntries(ROSTER.map((p,i)=>[p.id,i])));
export function getCharacter(id){return ROSTER.find(p=>p.id===id)??ROSTER[0];}
export function matchConfiguration(opponent){return {aiSpeed:opponent.aiSpeed,aiAcceleration:opponent.aiAcceleration,aiStyle:opponent.style,scoreToWin:7};}