# -*- coding: utf-8 -*-
import json, os, re, io, cgi, base64, mimetypes, subprocess
from http.server import HTTPServer, ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BASE_URL = 'https://modelsnexus.org/v1'
DEFAULT_MODEL = 'qwen3.7-max'
DEFAULT_TIMEOUT = 180

def load_local_env():
    """Load simple KEY=value pairs without requiring python-dotenv."""
    path=os.path.join(ROOT,'.env')
    if not os.path.exists(path):
        return
    try:
        with open(path,'r',encoding='utf-8') as env_file:
            for line in env_file:
                line=line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key,value=line.split('=',1)
                key=key.strip(); value=value.strip().strip('"').strip("'")
                if key and value:
                    os.environ[key]=value
    except OSError as error:
        print('Could not read .env:',error)

load_local_env()

def local_plan(profile, reason=''):
    stage=profile.get('stage','本科大三下'); school=profile.get('school','211'); major=profile.get('major','计算机'); target=profile.get('target','AI 产品经理'); exp=profile.get('experience',''); updates=profile.get('updates',[])
    recent=' '.join(str(x) for x in updates); evidence=profile.get('evidence',[]); evidence_text=' '.join(str(x.get('content','')) if isinstance(x,dict) else str(x) for x in evidence)
    # A progress note can correct stale profile fields, especially the target role.
    if '软件安全工程师' in recent or '安全工程师' in recent: target='软件安全工程师'
    if '信息安全' in recent: major='信息安全'
    if '大三下' in recent: stage='本科大三下'
    if '211' in recent: school='211'
    if '宇树科技' in recent and ('失败' in recent or '拒' in recent):
        exp=(exp+'；宇树科技面试失败').strip('；')
    if '面试失败' in evidence_text or '未通过' in evidence_text:
        gaps_extra=['面试复盘与项目表达']
    else: gaps_extra=[]
    actions=['拆解 10 个目标岗位 JD','把一个项目补成用户与指标案例','准备一次目标岗位项目深挖']
    action_guides=[{'title':actions[0],'why':'你需要先知道目标岗位真正要求什么，避免盲目投递。','steps':['收集 10 个近 30 天发布的 JD','标注重复出现的能力和产出','把最高频的 3 项写进简历'],'doneWhen':'完成一张岗位能力对照表'},{'title':actions[1],'why':'招聘方需要看到你能从问题走到结果，而不是只会做 Demo。','steps':['写清目标用户和原始问题','选一个主指标记录前后变化','补上一次取舍和失败复盘'],'doneWhen':'形成一页可讲 3 分钟的项目案例'},{'title':actions[2],'why':'项目深挖是验证产品思考和技术理解的最高频环节。','steps':['准备背景、目标、方案、指标四句话','为 AI 失败、成本和延迟准备答案','录音完成一次 15 分钟自问自答'],'doneWhen':'能在 3 分钟内讲清项目并回答追问'}]
    return {'source':'local','status':'degraded','reason':reason,'profile':f'{stage} · {school} {major}','summary':f'{exp} · 目标：{target}'+(f' · 最近进展：{updates[-1]}' if updates else ''),'currentRoles':[{'title':f'{target}实习生','match':78,'reason':'当前背景与岗位的技术理解要求有重合。'}],'graduationRoles':[{'title':f'{target}（应用方向）','match':64,'reason':'补齐真实业务和结果证据后，毕业时可重点投递。'}],'gaps':['真实业务实习','可量化项目结果','产品指标意识']+gaps_extra,'actions':actions,'actionGuides':action_guides,'stages':[{'title':f'拿到第一段 {target} 实习','why':'获得真实用户、需求和协作经验。','tasks':['筛选有真实用户的团队','完成 10 个高质量投递','复盘每次面试反馈'],'doneWhen':'拿到 offer 或完成 10 次有效面试'},{'title':f'补齐 {target} 的能力证据','why':'把项目从 Demo 变成可验证的业务案例。','tasks':['定义一个主指标','记录迭代前后变化','写一页复盘'],'doneWhen':'有一份可讲清目标、取舍、结果的案例'},{'title':f'冲刺毕业 {target} 岗','why':'用前两阶段证据匹配毕业岗位。','tasks':['整理作品集','每周模拟一次面试','针对 JD 补行业知识'],'doneWhen':'完成目标岗位的成套投递'}]}

def normalize(raw, profile):
    if not isinstance(raw,dict): return local_plan(profile,'模型返回不是 JSON 对象')
    fallback=local_plan(profile)
    for key in ('currentRoles','graduationRoles','gaps','actions','actionGuides','stages'):
        if not isinstance(raw.get(key),list) or not raw[key]: raw[key]=fallback[key]
    raw['profile']=str(raw.get('profile') or fallback['profile']); raw['summary']=str(raw.get('summary') or fallback['summary']); raw['source']='ai'; raw['status']='ready'; return raw

def curl_chat(base, key, payload, timeout):
    config = 'url = "' + base.rstrip('/') + '/chat/completions"\n'
    config += 'request = POST\n'
    config += 'header = "Authorization: Bearer ' + key + '"\n'
    config += 'header = "Content-Type: application/json"\n'
    config += 'data = ' + json.dumps(json.dumps(payload, ensure_ascii=False)) + '\n'
    result = subprocess.run(
        ['curl', '--silent', '--show-error', '--fail', '--no-buffer', '--connect-timeout', '10', '--max-time', str(int(timeout)), '--config', '-'],
        input=config.encode('utf-8'), capture_output=True
    )
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', 'replace').strip() or 'curl request failed')
    text=result.stdout.decode('utf-8','replace')
    try:
        return json.loads(text)
    except ValueError:
        message=''
        for line in text.splitlines():
            line=line.strip()
            if not line.startswith('data:') or line.endswith('[DONE]'):
                continue
            try:
                chunk=json.loads(line[5:].strip())
                delta=chunk.get('choices',[{}])[0].get('delta',{}).get('content','')
                message+=delta
            except (ValueError,IndexError,AttributeError):
                continue
        if not message:
            raise RuntimeError('stream response contained no assistant content')
        return {'choices':[{'message':{'content':message}}]}

def compact_profile(profile):
    compact={}
    for key in ('stage','school','major','target','mood'):
        compact[key]=str(profile.get(key,'')).strip()[:300]
    compact['experience']=str(profile.get('experience','')).strip()[:4000]
    compact['updates']=[str(item)[:800] for item in profile.get('updates',[])[-12:]]
    evidence=[]; budget=10000
    for item in reversed(profile.get('evidence',[])[-8:]):
        if budget<=0: break
        if isinstance(item,dict):
            content=str(item.get('content',''))[:min(3500,budget)]
            evidence.append({'type':str(item.get('type',''))[:100],'content':content})
        else:
            content=str(item)[:min(3500,budget)]
            evidence.append(content)
        budget-=len(content)
    compact['evidence']=list(reversed(evidence))
    return compact

def make_plan(profile):
    nexus_key=os.environ.get('MODELSNEXUS_API_KEY'); qwen_key=os.environ.get('DASHSCOPE_API_KEY'); key=nexus_key or qwen_key or os.environ.get('OPENAI_API_KEY')
    base=os.environ.get('AI_BASE_URL') or (DEFAULT_BASE_URL if nexus_key else ('https://dashscope.aliyuncs.com/compatible-mode/v1' if qwen_key else 'https://api.openai.com/v1'))
    model=os.environ.get('AI_MODEL') or (DEFAULT_MODEL if nexus_key else ('qwen-plus' if qwen_key else 'gpt-4o-mini'))
    if not key: return local_plan(profile,'未配置 API Key')
    schema='''只返回 JSON，不要 Markdown。结构必须为：{"profile":"string","summary":"string","currentRoles":[{"title":"string","match":0,"reason":"string"}],"graduationRoles":[{"title":"string","match":0,"reason":"string"}],"gaps":["string"],"actions":["string"],"actionGuides":[{"title":"string","why":"string","steps":["string","string","string"],"doneWhen":"string"}],"stages":[{"title":"string","why":"string","tasks":["string","string","string"],"doneWhen":"string"}]}。match 为 0-100 的整数，不要伪造录取概率。'''
    model_profile=compact_profile(profile)
    prompt=f'你是可信的应届生职业规划产品。根据用户画像、最近进展和证据材料，重新判断现在可投和毕业可达岗位。材料不是存档：必须说明它确认了什么能力、暴露了什么缺口，以及计划哪些阶段需要调整。最近进展中的明确事实优先级高于旧画像：如果用户说目标已转向某岗位，必须把 profile、currentRoles、graduationRoles、stages 全部改成新目标。面试失败要转成具体复盘缺口，而不是继续推荐旧方向。回答精炼，每个字段只保留对求职决策有用的信息。{schema}\n用户画像：{json.dumps(model_profile,ensure_ascii=False)}'
    try:
        payload={'model':model,'messages':[{'role':'user','content':prompt}],'temperature':0.2,'max_tokens':1600,'enable_thinking':False,'stream':False}
        req=Request(base.rstrip('/')+'/chat/completions',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
        if os.environ.get('AI_TRANSPORT','curl').lower() == 'curl':
            raw=curl_chat(base,key,payload,max(180.0,min(float(os.environ.get('AI_TIMEOUT',DEFAULT_TIMEOUT)),240.0)))
            content=raw['choices'][0]['message']['content']
            fence=chr(96)*3
            content=content.replace(fence+'json','').replace(fence,'').strip()
            return normalize(json.loads(content),profile)
        raw=json.loads(urlopen(req,timeout=float(os.environ.get('AI_TIMEOUT',DEFAULT_TIMEOUT))).read()); content=raw['choices'][0]['message']['content']; content=re.sub(r'^```(?:json)?\s*|\s*```$','',content.strip()); return normalize(json.loads(content),profile)
    except Exception as error:
        if os.environ.get('AI_TRANSPORT','curl').lower() == 'curl':
            print('AI request failed; using local plan:',error)
            return local_plan(profile,str(error))
        try:
            raw = curl_chat(base, key, payload, max(180.0,min(float(os.environ.get('AI_TIMEOUT', DEFAULT_TIMEOUT)),240.0)))
            content = raw['choices'][0]['message']['content']
            fence = chr(96) * 3
            content = content.replace(fence + 'json', '').replace(fence, '').strip()
            return normalize(json.loads(content), profile)
        except Exception as curl_error:
            reason = str(error) + '; curl fallback: ' + str(curl_error)
            print('AI request failed; using local plan:', reason)
            return local_plan(profile, reason)

def local_action_guide(action, profile, reason=''):
    target=str(profile.get('target') or '目标岗位')
    return {
        'title': action,
        'why': f'这项行动会为“{target}”补充一条可验证的能力证据。',
        'steps': [
            f'先明确“{action}”最终要交付的具体结果',
            '把任务拆成 3 个不超过 45 分钟的小步骤，并先完成第一步',
            '整理过程、结果和一次复盘，形成可在面试中讲述的材料'
        ],
        'resources': ['目标岗位 JD', '个人项目或经历材料', '一页复盘模板'],
        'estimatedTime': '2-4 小时，可拆成 2 次完成',
        'doneWhen': '产出一份可查看、可复述、可提交的成果',
        'evidence': '完成后上传文档、截图、链接或复盘文字，作为这项行动的证据。',
        'source': 'local',
        'reason': reason
    }

def make_action_guide(payload):
    profile=compact_profile(payload.get('profile') or {})
    action=str(payload.get('action') or '').strip()[:300]
    if not action:
        return local_action_guide('完成当前行动',profile,'缺少行动名称')
    nexus_key=os.environ.get('MODELSNEXUS_API_KEY'); qwen_key=os.environ.get('DASHSCOPE_API_KEY'); key=nexus_key or qwen_key or os.environ.get('OPENAI_API_KEY')
    base=os.environ.get('AI_BASE_URL') or (DEFAULT_BASE_URL if nexus_key else ('https://dashscope.aliyuncs.com/compatible-mode/v1' if qwen_key else 'https://api.openai.com/v1'))
    model=os.environ.get('AI_MODEL') or (DEFAULT_MODEL if nexus_key else ('qwen-plus' if qwen_key else 'gpt-4o-mini'))
    if not key:
        return local_action_guide(action,profile,'未配置 API Key')
    schema='''只返回 JSON，不要 Markdown。结构必须为：{"title":"string","why":"string","steps":["string"],"resources":["string"],"estimatedTime":"string","doneWhen":"string","evidence":"string"}。steps 必须是 3-5 个具体动作；不得虚构链接、招聘信息或用户经历。'''
    prompt=f'''你是应届生职业行动教练。请只深化一个行动项，不要重新生成整份职业规划。指导必须结合用户阶段、目标岗位、已有经历、最近进展和证据；写到用户现在就能照着做的程度。{schema}\n行动项：{action}\n用户画像：{json.dumps(profile,ensure_ascii=False)}'''
    request_payload={'model':model,'messages':[{'role':'user','content':prompt}],'temperature':0.2,'max_tokens':900,'enable_thinking':False,'stream':False}
    try:
        raw=curl_chat(base,key,request_payload,max(60.0,min(float(os.environ.get('ACTION_GUIDE_TIMEOUT',90)),120.0)))
        content=raw['choices'][0]['message']['content']; fence=chr(96)*3
        result=json.loads(content.replace(fence+'json','').replace(fence,'').strip())
        fallback=local_action_guide(action,profile)
        for field in ('title','why','estimatedTime','doneWhen','evidence'):
            result[field]=str(result.get(field) or fallback[field])
        for field in ('steps','resources'):
            if not isinstance(result.get(field),list) or not result[field]: result[field]=fallback[field]
        result['source']='ai'; return result
    except Exception as error:
        print('Action guide request failed; using local guide:',error)
        return local_action_guide(action,profile,str(error))

def extract_document(filename, content, content_type):
    ext=os.path.splitext(filename.lower())[1]
    if ext in ('.txt','.md','.json','.csv') or content_type.startswith('text/'):
        return content.decode('utf-8','replace')
    if ext=='.pdf':
        try:
            from pypdf import PdfReader
            reader=PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                try:
                    reader.decrypt('')
                except Exception:
                    return 'PDF 已上传，但文件有密码保护，无法提取文字。请上传解锁后的 PDF。'
            text='\n'.join(page.extract_text() or '' for page in reader.pages).strip()
            return text or 'PDF 已上传，但没有可提取的文字。它可能是扫描图片，请使用带 OCR 的 PDF 或粘贴文字。'
        except ImportError:
            return 'PDF 已上传。安装 pypdf 后可提取 PDF 文本。'
        except Exception as error:
            return f'PDF 已上传，但解析失败：{error}'
    if ext=='.docx':
        try:
            from docx import Document
            return '\n'.join(p.text for p in Document(io.BytesIO(content)).paragraphs)
        except ImportError:
            return 'DOCX 已上传。安装 python-docx 后可提取文档文本。'
    if ext in ('.png','.jpg','.jpeg','.webp'):
        return analyze_image(filename, content, content_type)
    if ext in ('.mp3','.m4a','.wav','.webm','.mp4'):
        return transcribe_audio(filename, content, content_type)
    return '文件已上传，但当前未配置对应解析器。'

def analyze_image(filename, content, content_type):
    """Use a configured vision-capable domestic gateway, otherwise keep a truthful local status."""
    key=os.environ.get('VISION_API_KEY') or os.environ.get('MODELSNEXUS_API_KEY')
    base=os.environ.get('VISION_BASE_URL') or os.environ.get('AI_BASE_URL') or DEFAULT_BASE_URL
    model=os.environ.get('VISION_MODEL') or os.environ.get('AI_MODEL') or DEFAULT_MODEL
    if not key:
        return '图片已保存，但未配置视觉模型。可设置 VISION_API_KEY、VISION_BASE_URL、VISION_MODEL，或安装本地 OCR 后再解析。'
    try:
        mime=content_type or mimetypes.guess_type(filename)[0] or 'image/jpeg'
        data='data:'+mime+';base64,'+base64.b64encode(content).decode('ascii')
        payload={'model':model,'messages':[{'role':'user','content':[{'type':'text','text':'请提取这张图片中的简历、项目、面试反馈或岗位信息。只返回纯文本，保留关键事实，不要臆测。'},{'type':'image_url','image_url':{'url':data}}]}],'temperature':0.1}
        req=Request(base.rstrip('/')+'/chat/completions',data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
        raw=json.loads(urlopen(req,timeout=float(os.environ.get('VISION_TIMEOUT',90))).read())
        return raw['choices'][0]['message']['content'].strip()[:30000]
    except Exception as error:
        return f'图片已保存，但视觉解析失败：{error}'

def transcribe_audio(filename, content, content_type):
    # OpenAI-compatible gateways may expose /audio/transcriptions. Keep this optional.
    key=os.environ.get('TRANSCRIBE_API_KEY') or os.environ.get('MODELSNEXUS_API_KEY')
    base=os.environ.get('TRANSCRIBE_BASE_URL') or DEFAULT_BASE_URL
    model=os.environ.get('TRANSCRIBE_MODEL','qwen3-audio-plus')
    if not key:
        # Optional local fallbacks. FunASR is tried first for Chinese audio.
        try:
            from funasr import AutoModel
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1], delete=False) as tmp:
                tmp.write(content); path=tmp.name
            asr=AutoModel(model=os.environ.get('FUNASR_MODEL','iic/SenseVoiceSmall'), disable_update=True)
            result=asr.generate(input=path, language=os.environ.get('LOCAL_WHISPER_LANGUAGE','zh'), use_itn=True)
            text=' '.join((item.get('text') or '') for item in result if isinstance(item,dict)).strip()
            if text: return text
        except ImportError:
            pass
        except Exception as error:
            print('FunASR unavailable; trying faster-whisper:',error)
        try:
            from faster_whisper import WhisperModel
            model_local=WhisperModel(os.environ.get('LOCAL_WHISPER_MODEL','base'), device='cpu', compute_type='int8')
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1], delete=False) as tmp:
                tmp.write(content); path=tmp.name
            segments,_=model_local.transcribe(path, language=os.environ.get('LOCAL_WHISPER_LANGUAGE','zh'))
            return ''.join(seg.text for seg in segments).strip() or '本地转写未识别到有效内容。'
        except ImportError:
            return '音频已保存，但未配置语音转写服务。可设置 TRANSCRIBE_API_KEY、TRANSCRIBE_BASE_URL、TRANSCRIBE_MODEL，或安装可选 faster-whisper 本地转写。'
        except Exception as error:
            return f'音频已保存，但本地转写失败：{error}'
    try:
        boundary='----PathwiseBoundary'; body=b''
        def field(name,value):
            return (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n').encode()
        body+=field('model',model);body+=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {content_type or "application/octet-stream"}\r\n\r\n').encode()+content+f'\r\n--{boundary}--\r\n'.encode()
        req=Request(base.rstrip('/')+'/audio/transcriptions',data=body,headers={'Authorization':'Bearer '+key,'Content-Type':'multipart/form-data; boundary='+boundary})
        return json.loads(urlopen(req,timeout=120).read()).get('text','')
    except Exception as error: return f'音频已上传，但转写失败：{error}'

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()
    def do_GET(self):
        if self.path in ('/', '/index.html'):
            self.send_response(302); self.send_header('Location','/career.html'); self.end_headers(); return
        if self.path=='/api/health':
            sources={'modelsnexus':bool(os.environ.get('MODELSNEXUS_API_KEY')),'dashscope':bool(os.environ.get('DASHSCOPE_API_KEY')),'openai':bool(os.environ.get('OPENAI_API_KEY'))}
            body=json.dumps({'configured':any(sources.values()),'sources':sources,'env_file':os.path.exists(os.path.join(ROOT,'.env')),'pid':os.getpid(),'model':os.environ.get('AI_MODEL') or DEFAULT_MODEL,'base_url':os.environ.get('AI_BASE_URL') or (DEFAULT_BASE_URL if sources['modelsnexus'] else '')},ensure_ascii=False).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_POST(self):
        if self.path=='/api/evidence':
            form=cgi.FieldStorage(fp=self.rfile,headers=self.headers,environ={'REQUEST_METHOD':'POST','CONTENT_TYPE':self.headers.get('Content-Type',''),'CONTENT_LENGTH':self.headers.get('Content-Length','')})
            fileitem=form['file'] if 'file' in form else None
            if fileitem is None or not getattr(fileitem,'filename',None): self.send_error(400,'missing file'); return
            raw=fileitem.file.read(); text=extract_document(fileitem.filename,raw,fileitem.type or 'application/octet-stream'); out={'filename':fileitem.filename,'type':fileitem.type,'text':text[:30000],'bytes':len(raw)}; body=json.dumps(out,ensure_ascii=False).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        if self.path not in ('/api/plan','/api/action-guide'): self.send_error(404); return
        n=int(self.headers.get('Content-Length',0)); payload=json.loads(self.rfile.read(n) or '{}')
        result=make_plan(payload) if self.path=='/api/plan' else make_action_guide(payload)
        body=json.dumps(result,ensure_ascii=False).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,*args): pass

def run_server():
    os.chdir(ROOT)
    port=int(os.environ.get('PORT','8787'))
    host=os.environ.get('HOST','127.0.0.1')
    sources='modelsnexus='+str(bool(os.environ.get('MODELSNEXUS_API_KEY')))+' dashscope='+str(bool(os.environ.get('DASHSCOPE_API_KEY')))
    print(f'Pathwise running at http://localhost:{port}/career.html | model={os.environ.get("AI_MODEL") or DEFAULT_MODEL} | {sources} | env_file={os.path.exists(os.path.join(ROOT,".env"))}')
    ThreadingHTTPServer((host,port),Handler).serve_forever()

if __name__ == '__main__':
    run_server()
