from urllib.request import urlretrieve
import json
import os
import subprocess

if __name__ == '__main__':
    img = os.listdir('img')
    for file in img:
        if file.endswith('.json'):
            with open('img/' + file, 'r') as f:
                data = json.load(f)
                for i in data:
                    localdir = i['local'].split('https://api-vercel.blockhaity.dpdns.org/')[1]
                    print('downloading '+i['source']+' to '+localdir)
                    # urlretrieve(i['source'],localdir)
                    status = subprocess.run(['aria2c', '-o', localdir, i['source']])
                    if status.returncode != 0:
                        raise Exception('download failed')