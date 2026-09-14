#!/usr/bin/env bash
#
# 打包脚本：把象棋做成一"包"可以直接发给朋友的软件。
#
#   ./build.sh
#
# 产出（在 dist/ 下）：
#   中国象棋-单文件版.html   把背景音乐也内嵌进去了，**一个文件就是完整游戏**，
#                            微信/QQ 直接发这一个文件，对方双击就能玩
#   中国象棋-完整包.zip      网页版全套（html + mp3 + 图标 + PWA 清单），
#                            解压后双击 index.html；放到服务器上还能"安装成应用"
#   中国象棋.desktop         Linux 桌面快捷方式（双击像启动一个软件）
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
OUT=dist
rm -rf "$OUT"; mkdir -p "$OUT/中国象棋"

echo "▶ 生成单文件版（内嵌背景音乐）..."
python3 - <<'PY'
import base64, pathlib
src = pathlib.Path('index.html').read_text(encoding='utf-8')
mp3 = pathlib.Path('bgm.mp3').read_bytes()
b64 = base64.b64encode(mp3).decode('ascii')
data_uri = 'data:audio/mpeg;base64,' + b64
old = "const BGM_SRC = 'bgm.mp3';"
assert old in src, '找不到 BGM_SRC，源文件版本不对？'
note = (
    "/* 单文件版：背景音乐已内嵌为 base64，不再依赖外部 bgm.mp3。\n"
    "   代价是文件大约 1.9MB，换来的是「发一个文件就能玩」。 */\n"
)
new = note + "const BGM_SRC = '" + data_uri + "';"
out = src.replace(old, new, 1)
pathlib.Path('dist/中国象棋-单文件版.html').write_text(out, encoding='utf-8')
print(f'  内嵌音频 {len(mp3)/1024/1024:.2f} MB → 产物 {len(out)/1024/1024:.2f} MB')
PY

echo "▶ 组装完整包..."
for f in index.html bgm.mp3 manifest.webmanifest sw.js icon.svg \
         icon-192.png icon-512.png apple-touch-icon.png favicon-32.png favicon-16.png favicon.ico; do
  [ -f "$f" ] && cp "$f" "$OUT/中国象棋/"
done

cat > "$OUT/中国象棋/使用说明.txt" <<'TXT'
中国象棋 · 人机对弈
====================

【怎么玩】
  双击 index.html 就会用浏览器打开，直接开下。
  第一次点"人机对战 · 我执红"会让你选难度：
      入门 / 普通 / 困难 / 大师
  想被虐就选【大师】。

【想稳输？】
  面板上有个「让我少子」下拉框，选【让我少双车（基本必输）】，
  再配【大师】难度 —— 基本必输。
  （这是明确写在界面上的主动削弱，程序没有偷偷改动任何东西。）

【背景音乐】
  本包已带 bgm.mp3。想换音乐就把同名文件替换掉即可。
  如果只是想发给朋友一个文件，用【中国象棋-单文件版.html】，
  音乐已经内嵌在里面，不需要任何其它文件。

【怎么发给朋友】
  方式一（最省事）：直接发【中国象棋-单文件版.html】这**一个文件**，
                   对方双击就能玩，音乐也在里面。
  方式二（有服务器）：把整个文件夹传上去，就能用手机"添加到主屏幕"
                   安装成 App，还能离线玩。
  方式三（在线）：https://the-hiker0.github.io/tiku/xiangqi/

【规则说明】
  本程序按"吃将定胜负"：不判将死，任何着法都能走，
  吃掉对方的将即为获胜。
  另加两条判和：同一局面重复三次、连续 60 回合无吃子。

【版权】
  代码可自由使用。图标为原创设计，不含任何第三方商标或素材。
TXT

echo "▶ 生成 Linux 桌面快捷方式..."
APP_DIR="$(pwd)"
cat > "$OUT/中国象棋.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=中国象棋
Name[en]=Chinese Chess
Comment=单文件中国象棋 · 四档难度 · 内置开局库
Exec=xdg-open "$APP_DIR/index.html"
Icon=$APP_DIR/icon-512.png
Terminal=false
Categories=Game;BoardGame;
DESK
chmod +x "$OUT/中国象棋.desktop"

echo "▶ 打 zip..."
( cd "$OUT" && zip -qr 中国象棋-完整包.zip 中国象棋 )

echo
echo "完成，产物在 $OUT/ ："
ls -la "$OUT" | awk 'NR>1 {printf "  %-34s %8.2f MB\n", $9, $5/1024/1024}'
