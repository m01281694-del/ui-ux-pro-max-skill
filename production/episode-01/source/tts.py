import json,base64,subprocess,sys,urllib.request,os
V="nPczCjzI2devNBz1zQrb"
S=json.load(open("script.json"))
only=sys.argv[1:] 
for i,s in enumerate(S):
    if only and s["id"] not in only: continue
    body={"text":s["text"],"model_id":"eleven_v3","language_code":"fr",
          "voice_settings":{"stability":0.5,"similarity_boost":0.8,"style":0.35,"use_speaker_boost":True}}
    req=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{V}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    
    try: d=json.load(urllib.request.urlopen(req,timeout=180))
    except urllib.error.HTTPError as e: print(s["id"],e.read()[:300]); continue
    open(f"audio/vo/{s['id']}.mp3","wb").write(base64.b64decode(d["audio_base64"]))
    json.dump(d["alignment"],open(f"audio/vo/{s['id']}.align.json","w"))
    print(s["id"], round(d["alignment"]["character_end_times_seconds"][-1],2))
