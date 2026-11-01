import assert from 'node:assert/strict';
import {AVATAR_CHOICES,DEFAULT_AVATAR,normalizeAvatar,cleanNickname,nicknameError,escapeHtml} from '../src/player-profile.js';
assert.equal(cleanNickname('  Étoile   42  '),'Étoile 42');
assert.equal(nicknameError('<script>'), 'Utilise des lettres, chiffres, espaces, points, tirets ou underscores.');
assert.ok(nicknameError('a'));
assert.throws(()=>cleanNickname('bad<script>'));
assert.equal(escapeHtml('<img src="x" onerror="bad">'),'&lt;img src=&quot;x&quot; onerror=&quot;bad&quot;&gt;');
assert.deepEqual(normalizeAvatar(null),DEFAULT_AVATAR);
assert.deepEqual(normalizeAvatar({skinTone:'#abcdef',eyeColor:'red',presentation:'androgyne',accessory:'bandana',unknown:'test'}),{
 ...DEFAULT_AVATAR,skinTone:'#abcdef',presentation:'androgyne',accessory:'bandana'
});
assert.equal(normalizeAvatar({hairColor:'#ABCDEF'}).hairColor,'#abcdef');
assert.equal(normalizeAvatar({skinTone:'url(javascript:evil)'}).skinTone,DEFAULT_AVATAR.skinTone);
assert.ok(AVATAR_CHOICES.presentation.includes('libre'));
console.log('Player profile validation verified.');
