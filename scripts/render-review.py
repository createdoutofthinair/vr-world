"""Software geometry contact sheets, for silhouettes/placement review only.
Not a WebGL, texture, UI, or native VP validation. Requires Pillow and NumPy.
Usage: python3 scripts/render-review.py INPUT_DIRECTORY OUTPUT_DIRECTORY
"""
import sys,json,math,pathlib,base64,io
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
source=pathlib.Path(sys.argv[1]);output=pathlib.Path(sys.argv[2]);output.mkdir(parents=True,exist_ok=True)
W,H=1200,900;S=1.5
asset_dir=pathlib.Path(__file__).resolve().parent.parent/'public'/'textures'
texture_files={'bark':'c3-bark012.jpg','soil':'c3-ground037.jpg','stone':'c3-rock035.jpg','wood':'c3-woodsiding006.jpg','brick':'c3-bricks060.jpg'}
textures={}
for pattern,name in texture_files.items():
    path=asset_dir/name
    if path.exists():
        pixels=np.array(Image.open(path).convert('RGB').resize((512,512),Image.Resampling.LANCZOS)).astype(float)
        textures[pattern]=np.clip(95+(pixels*np.array([.2126,.7152,.0722])).sum(axis=2)*.72,0,255)/255
for file in sorted(source.glob('*.json')):
    data=json.loads(file.read_text());p=data['project'];extent=p['landscape']['extent'];w=p['width'];d=p['depth']
    eye=np.array([w*1.2+extent,p['height']*2.1+extent*.9,d*1.55+extent*1.15]);target=np.array([0,p['height']*.65,0.])
    if p['world']['enabled']:
        spacing=p['world']['blockSize']+p['world']['roadWidth']+2*p['world']['sidewalkWidth'];distance=p['world']['blocks']*spacing*.95
        eye=np.array([distance*.85,distance*.9,distance*1.15]);target=np.array([0,2,0.])
    if data.get('camera'):
        eye=np.array(data['camera']['eye'],dtype=float);target=np.array(data['camera']['target'],dtype=float)
    forward=target-eye;forward/=np.linalg.norm(forward);right=np.cross(forward,[0.,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward)
    def project(v):
        rel=v-eye;z=rel@forward;return np.stack([W/2+(rel@right)/z*H*1.22,H/2-(rel@up)/z*H*1.22],axis=-1)*S
    colors={'temperate':('#c0d1d6','#e2e7df'),'desert':('#c8d1d6','#e8dac2'),'jungle':('#b8c8c3','#d8dfd1'),'fantasy':('#becbd0','#dce0d2'),'scifi':('#bac6d3','#d7d6df')}
    def rgb(c):return np.array([int(c[i:i+2],16) for i in (1,3,5)])
    a,b=map(rgb,colors[p['theme']]);background=np.zeros((int(H*S),int(W*S),3),dtype=np.uint8)
    for y in range(background.shape[0]):background[y,:]=a*(1-y/background.shape[0])+b*(y/background.shape[0])
    image=Image.fromarray(background).convert('RGBA');draw=ImageDraw.Draw(image)
    light=np.array([-.48,.79,.39]);light/=np.linalg.norm(light)
    faces=[];terrain=[];shadows=[]
    for mesh in data['meshes']:
        v=np.array(mesh['positions']).reshape(-1,3)+np.array(mesh['origin']);idx=np.array(mesh['indices']).reshape(-1,3)
        base=rgb(mesh.get('materialColor',data['materials'][mesh['material']]['color']));opacity=data['materials'][mesh['material']]['opacity'];pattern=data['materials'][mesh['material']]['pattern'];uvs=np.array(mesh['uvs']).reshape(-1,2)
        if mesh.get('bakedTexture'):
            pattern='baked:'+mesh['id'];textures[pattern]=np.array(Image.open(io.BytesIO(base64.b64decode(mesh['bakedTexture']['dataUrl'].split(',')[1]))).convert('RGB')).astype(float)/255
        projected=project(v)
        for tri in idx:
            vertices=v[tri];n=np.cross(vertices[1]-vertices[0],vertices[2]-vertices[0]);ln=np.linalg.norm(n)
            if ln<1e-10:continue
            n/=ln;center=vertices.mean(axis=0)
            if np.dot(n,eye-center)<=0:continue
            polygon=[tuple(q) for q in projected[tri]]
            if any(not all(math.isfinite(x) for x in point) for point in polygon):continue
            if mesh['material']=='glass':continue
            brightness=.43+.56*max(0,np.dot(n,light))+.08*max(0,n[1])
            color=tuple(np.clip(base*brightness,0,255).astype(int))+(255,)
            item=(float((center-eye)@forward),polygon,color,(vertices-eye)@forward,uvs[tri],pattern)
            (terrain if mesh.get('surfacePatch') or mesh['id']=='site-ground' else faces).append(item)
            if mesh['category'] not in ('site','landscape') and center[1]>.2:
                projected_shadow=vertices.copy();projected_shadow[:,0]-=vertices[:,1]*light[0]/light[1];projected_shadow[:,2]-=vertices[:,1]*light[2]/light[1];projected_shadow[:,1]=-.008
                shadows.append([tuple(q) for q in project(projected_shadow)])
    pixels=np.array(image)
    depth_buffer=np.full((int(H*S),int(W*S)),np.inf)
    def raster(items):
        for _,poly,color,depths,uvs,pattern in items:
            xy=np.array(poly);x0=max(0,int(np.floor(xy[:,0].min())));x1=min(int(W*S)-1,int(np.ceil(xy[:,0].max())))
            y0=max(0,int(np.floor(xy[:,1].min())));y1=min(int(H*S)-1,int(np.ceil(xy[:,1].max())))
            if x0>x1 or y0>y1:continue
            a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-8:continue
            yy,xx=np.mgrid[y0:y1+1,x0:x1+1];xx=xx+.5;yy=yy+.5
            u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
            v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
            ww=1-u-v
            zz=1/(u/depths[0]+v/depths[1]+ww/depths[2])
            region=depth_buffer[y0:y1+1,x0:x1+1]
            mask=(u>=0)&(v>=0)&(ww>=0)&(zz<region)
            region[mask]=zz[mask]
            pixels[y0:y1+1,x0:x1+1][mask]=color
            if pattern in textures:
                uv=(u[mask,None]*uvs[0]/depths[0]+v[mask,None]*uvs[1]/depths[1]+ww[mask,None]*uvs[2]/depths[2])*zz[mask,None]
                tex=textures[pattern];height,width=tex.shape[:2]
                tx=np.floor(uv[:,0]*width).astype(int);ty=np.floor((1-uv[:,1])*height).astype(int)
                if pattern.startswith('baked:'):tx=np.clip(tx,0,width-1);ty=np.clip(ty,0,height-1)
                else:tx%=width;ty%=height
                sample=tex[ty,tx] if tex.ndim==3 else tex[ty,tx,None]
                shaded=np.array(color[:3])[None,:]*sample
                pixels[y0:y1+1,x0:x1+1,:3][mask]=shaded.astype(np.uint8)
    raster(terrain)
    shadow=Image.new('L',image.size);sd=ImageDraw.Draw(shadow)
    for poly in shadows:sd.polygon(poly,fill=43)
    shadow=np.array(shadow.filter(ImageFilter.GaussianBlur(1.1*S)))/255
    mask=np.isfinite(depth_buffer)
    pixels[mask,:3]=(pixels[mask,:3]*(1-shadow[mask,None])).astype(np.uint8)
    raster(faces)
    image=Image.fromarray(pixels)
    image=image.resize((W,H),Image.Resampling.LANCZOS).convert('RGB');image.save(output/f'c3-{file.stem}.png',optimize=True)
    print(file.stem,'rendered',len(faces),'visible triangles')
