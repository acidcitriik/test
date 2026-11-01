// Player appearance describes a fictional avatar, never a person's gender identity.
export const AVATAR_CHOICES=Object.freeze({
  presentation:Object.freeze(['neutre','masculine','feminine','androgyne','libre']),
  hairStyle:Object.freeze(['court','long','boucle','rase','mohawk','afro','tresses','aucun']),
  accessory:Object.freeze(['aucun','bandana','masque','visiere','lunettes','cicatrice'])
});
export const DEFAULT_AVATAR=Object.freeze({
  version:1,presentation:'neutre',skinTone:'#c98c64',eyeColor:'#5d9aa7',
  hairStyle:'court',hairColor:'#362535',accessory:'aucun'
});
const COLOR=/^#[0-9a-f]{6}$/i;
export function normalizeAvatar(value){
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const out={...DEFAULT_AVATAR};
  for(const field of ['presentation','hairStyle','accessory']){
    if(AVATAR_CHOICES[field].includes(raw[field]))out[field]=raw[field];
  }
  for(const field of ['skinTone','eyeColor','hairColor']){
    if(typeof raw[field]==='string'&&COLOR.test(raw[field]))out[field]=raw[field].toLowerCase();
  }
  return out;
}
export function nicknameError(value){
  if(typeof value!=='string')return 'Saisis un pseudo.';
  const name=value.trim().replace(/\s+/g,' ');
  const length=Array.from(name).length;
  if(length<3||length>24)return 'Le pseudo doit contenir entre 3 et 24 caractères.';
  if(!/^[\p{L}\p{N} _.-]+$/u.test(name))return 'Utilise des lettres, chiffres, espaces, points, tirets ou underscores.';
  return '';
}
export function cleanNickname(value){
  const name=String(value??'').trim().replace(/\s+/g,' ');
  const error=nicknameError(name);
  if(error)throw new Error(error);
  return name;
}
export function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}
