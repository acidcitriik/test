"""Restore MUTE's clipped viewer-left hair using pixels from her own locks.

Lossless raster editing: face and clothing kept pixel-for-pixel; no gameplay,
physics, stage, camera, UI or other character changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/characters/mute.webp'
assert SOURCE.exists()
im = Image.open(SOURCE).convert('RGBA')
w, h = im.size
assert (w, h) == (500, 600)
mirror = np.asarray(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT), dtype=np.uint8)
reconstruction = np.zeros((h, w, 4), dtype=np.uint8)
for y in range(68, 493):
    vertical = max(0., min(1., (y-68)/38, (493-y)/65))
    seam = np.interp(y, [68,105,145,195,245,292,335,390,445,493],
                       [230,195,174,166,163,170,172,165,161,143])
    start = np.interp(y, [68,105,145,195,245,292,335,390,445,493],
                        [220,180,105,97,95,102,107,103,102,135])
    minsrc = np.interp(y, [68,140,195,250,300,355,410,460,493],
                         [275,300,310,377,366,340,318,322,330])
    for x in range(max(0, int(start)-20), min(w, int(seam)+4)):
        t = np.clip((seam-x)/22., 0., 1.)
        edge = t*t*(3-2*t)
        src_x = int(np.clip(x-22, 0, w-1))
        original_x = w-1-src_x
        if original_x < minsrc:
            continue
        pix = mirror[y, src_x]
        if pix[3] < 24:
            continue
        reconstruction[y,x,:3] = np.clip(
            pix[:3].astype(float)*(.90+.09*x/200), 0, 255)
        reconstruction[y,x,3] = round(float(pix[3])*vertical*edge)

under = Image.fromarray(reconstruction, mode='RGBA')
under.putalpha(under.getchannel('A').filter(ImageFilter.GaussianBlur(.65)))

# The historic rectangular clipping wedge left a triangular hole. Use real
# strands from MUTE's top hair as a softly blended repair, below source paint.
patch_mask = Image.new('L',(w,h),0)
ImageDraw.Draw(patch_mask).polygon(
    [(143,139),(162,128),(187,153),(184,174),(174,197),(142,225),(129,199)],
    fill=255)
patch_mask = patch_mask.filter(ImageFilter.GaussianBlur(2.0))
patch=np.zeros((h,w,4),dtype=np.uint8)
masked=np.asarray(patch_mask)
source_rgba=np.asarray(im)
for yy in range(120,234):
    for xx in range(120,197):
        a=int(masked[yy,xx])
        if a<1:
            continue
        sx=int(np.clip(xx+46,0,w-1))
        sy=int(np.clip(yy-54,0,h-1))
        pix=source_rgba[sy,sx]
        if pix[3]<200:
            continue
        patch[yy,xx,:3]=pix[:3]
        patch[yy,xx,3]=a
under = Image.alpha_composite(under, Image.fromarray(patch,'RGBA'))
merged = Image.alpha_composite(under, im)

# Eliminate invisible magenta / green RGB remnants from fully transparent pixels.
clean = np.asarray(merged).copy()
clean[clean[:,:,3] == 0,:3] = 0
merged = Image.fromarray(clean, 'RGBA')
assert np.array_equal(np.asarray(im)[210:380,205:305],
                      np.asarray(merged)[210:380,205:305]), 'Face modified'
merged.save(SOURCE, format='WEBP',lossless=True,method=6,exact=True)
print('MUTE restored:', SOURCE, SOURCE.stat().st_size)
