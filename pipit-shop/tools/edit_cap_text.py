import numpy as np,cv2,json,struct
from PIL import Image,ImageDraw,ImageFont,ImageFilter
FONT='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
def text_layer(txt,cap_h,track,ss=4):
    # возвращает маску L (0..255) текста с заданной высотой заглавных, трекинг в долях em
    f0=ImageFont.truetype(FONT,200);capr=(f0.getbbox('H')[3]-f0.getbbox('H')[1])/200
    em=int(cap_h*ss/capr);f=ImageFont.truetype(FONT,em)
    adv=[f.getlength(c) for c in txt];tr=track*em
    W=int(sum(adv)+tr*(len(txt)-1))+8*ss;H=int(em*1.4)
    im=Image.new('L',(W,H),0);d=ImageDraw.Draw(im);x=4*ss;top=None
    for c,a in zip(txt,adv):
        d.text((x,0),c,font=f,fill=255);x+=a+tr
    b=im.getbbox();im=im.crop(b)
    return im.resize((max(1,im.width//ss),max(1,im.height//ss)),Image.LANCZOS)
def wear(mask,seed):
    r=np.random.RandomState(seed);h,w=mask.shape
    n=cv2.GaussianBlur(r.rand(h,w).astype(np.float32),(0,0),1.2);n=(n-n.mean())/(n.std()+1e-6)
    n2=cv2.GaussianBlur(r.rand(h,w).astype(np.float32),(0,0),9);n2=(n2-n2.mean())/(n2.std()+1e-6)
    a=mask.astype(np.float32)/255*np.clip(.93+.05*n+.05*n2,.62,1.0)
    return cv2.GaussianBlur(a,(0,0),.55)
def replace(path,box,shift,new_txt,cap_h,track,flip,cx,cy,out,ink=None,seed=1,width=None):
    img=np.array(Image.open(path).convert('RGB')).astype(np.float32)
    x0,y0,x1,y1=box;g=img.mean(2)
    m=np.zeros(g.shape,np.uint8);m[y0:y1,x0:x1]=(g[y0:y1,x0:x1]>120)
    ink_col=img[y0:y1,x0:x1][m[y0:y1,x0:x1]>0].mean(0) if ink is None else np.array(ink,np.float32)
    md=cv2.dilate(m,np.ones((9,9),np.uint8),iterations=2)
    soft=cv2.GaussianBlur(md.astype(np.float32),(0,0),5)[...,None];soft=np.clip(soft*1.6,0,1)
    dy,dx=shift;src=np.roll(img,(dy,dx),axis=(0,1))   # чистая ткань соседнего участка (кратно периоду переплетения)
    # крупные тона берём из окружения дыры (Telea), мелкую фактуру переплетения из донора
    u8=np.clip(img,0,255).astype(np.uint8);hole=cv2.dilate(m,np.ones((15,15),np.uint8),iterations=2)
    base=cv2.inpaint(u8,hole,21,cv2.INPAINT_TELEA).astype(np.float32);low=cv2.GaussianBlur(base,(0,0),14)
    hi=src-cv2.GaussianBlur(src,(0,0),14);fill=low+hi
    img=img*(1-soft)+fill*soft
    tl=text_layer(new_txt,cap_h,track)
    if width:tl=tl.resize((width,tl.height),Image.LANCZOS)
    if flip=='ud':tl=tl.transpose(Image.FLIP_TOP_BOTTOM)
    if flip=='rot':tl=tl.rotate(180)
    a=np.array(tl);full=np.zeros(g.shape,np.uint8)
    tx=int(cx-a.shape[1]/2);ty=int(cy-a.shape[0]/2);full[ty:ty+a.shape[0],tx:tx+a.shape[1]]=a
    al=wear(full,seed)[...,None]
    img=img*(1-al)+ink_col*al
    Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save(out,quality=93,subsampling=0)
    print(path,'ink',ink_col.round(),'text',a.shape[::-1])
if __name__=='__main__':
    import sys
    # определить ориентацию надписи на козырьке по корреляции
    ref=np.array(Image.open('img1.jpg').convert('L'))[300:404,845:1211]>150
    best=None
    for fl in ['none','ud','rot']:
        t=text_layer('PIPIT',103,0.04)
        if fl=='ud':t=t.transpose(Image.FLIP_TOP_BOTTOM)
        if fl=='rot':t=t.rotate(180)
        t=np.array(t.resize((ref.shape[1],ref.shape[0])))>128
        sc=(t&ref).sum()/max(1,(t|ref).sum());print(fl,round(sc,3))
        if best is None or sc>best[0]:best=(sc,fl)
    open('flip.txt','w').write(best[1])
