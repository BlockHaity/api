from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import os
import time
import re
import json

def get_final_url(url):
    # 设置请求头，模拟浏览器访问
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # 创建请求对象
        request = Request(url, headers=headers)
        # 打开URL
        response = urlopen(request)
        # 获取最终URL
        final_url = response.geturl()
        return final_url
    except HTTPError as e:
        print(f"HTTP错误: {e.code} {e.reason}")
        return None
    except URLError as e:
        print(f"URL错误: {e.reason}")
        return None
    except Exception as e:
        print(f"发生错误: {e}")
        return None

if __name__ == "__main__":
    print("开始生成api/baapk.json")
    os.chdir("api")
    baapk = {}
    baapk["date"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    # global
    url = "https://api.blockhaity.dpdns.org/baapk/global"
    baapk["global"] = get_final_url(url)
    # jp
    url = "https://api.blockhaity.dpdns.org/baapk/jp"
    baapk["jp"] = get_final_url(url)
    # cn
    html = urlopen("https://api.blockhaity.dpdns.org/baapk/cn").read().decode("utf-8")
    baapk["cn"] = re.findall(r'https://pkg.bluearchive-cn.com[^\s\'"]+?\/com.RoamingStar.BlueArchive.apk', html)[0]
    # cn_bili
    baapk["cn_bili"] = json.loads(urlopen("https://line1-h5-pc-api.biligame.com/game/detail/gameinfo?game_base_id=109864").read().decode("utf-8")
                                  )['data']['android_download_link']
    # 保存
    print("保存api/baapk.json")
    json.dump(baapk, open("api/baapk.json", "w", encoding="utf-8"), ensure_ascii=False, indent=4)