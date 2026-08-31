# Alto Fingering Player

純前端中音薩克斯練習工具：載入樂譜、控制速度、跟著大張指法圖吹。

沒有後端、登入、遠端曲庫。檔案只在你的瀏覽器裡開啟。

- **線上試用：** https://ergeargwer.github.io/alto-fingering-player/
- **原始碼：** https://github.com/ergeargwer/alto-fingering-player

## 使用

1. 開 [`index.html`](index.html)（或上面的 GitHub Pages）。內建示範曲 **Practice Riff**（記譜音高、4/4、90 BPM）立刻可吹。
2. 空白鍵或「播放」。指法圖跟著目前的音；下一音在右側卡片。
3. 可載入本機 `.xml` / `.musicxml` / JSON。不會上傳。
4. 若檔案是鋼琴實音，勾選「此檔為實音」（上移大六度再查指法）。
5. 多聲部用「聲部」下拉選單。
6. [`fingering-test.html`](fingering-test.html)：記譜鋼琴逐音核對指法。游標停在鍵上或點一下可看鍵名。

本機伺服器（取樣音檔用 `fetch`，建議不要用 `file://`）：

```bash
python3 -m http.server 8765 --directory .
# 開 http://127.0.0.1:8765/
```

## 練習教練

- **預備拍：** 播放前先打一小節拍點
- **A–B：** 拖進度條兩端循環片段
- **慢速起：** 第一遍 70%，接著原速
- 目前音至少顯示 0.3 秒（十六分音符不會一閃而過）
- **靜音**只關聲音，游標不停

速度（40–160 BPM）、顯示模式、音源、預備拍／慢速起存在 `localStorage`。

## 指法與音高

- 樂器：中音薩克斯（E♭）
- 指法、畫面音名＝**記譜音**（B♭3–F♯6）
- 聽到的聲音＝**實音**（記譜 −9 半音）
- 對照 [Woodwind Fingering Guide](https://www.wfg.woodwind.org/sax/sax_bas_1.html) 基本表  
  B♭＝側 B♭（Bis 為備用）；**C5 只按左 2**；D5 起加八度

顯示：**指法** / **音名** / **兩者**。

## 音源

選單標籤：**音源：Alto 取樣**

| 選項 | 說明 |
|------|------|
| 取樣 Alto（預設） | FluidR3 六音 MP3，中間音變速 |
| 後備合成音 | 簧片感 bandpass + 氣聲（不是方波） |

取樣載入失敗會自動改用合成音。授權見 [`samples/LICENSE.txt`](samples/LICENSE.txt)：Fluid (R3) SoundFont（Frank Wen，**MIT**）；預渲染 via [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts)（MIT）。未打包完整 GM 庫。

## JSON 樂譜

`dur` 以四分音符為一拍。

```json
{
  "title": "練習",
  "bpm": 90,
  "notes": [
    { "pitch": "G4", "dur": 0.5 },
    { "rest": true, "dur": 4 }
  ]
}
```

MusicXML 讀第一條單旋律：`<pitch>` / `<duration>` / `<voice>` / `<rest>`、`divisions`、`<sound tempo>` 或 `<metronome>`。解析失敗時示範曲仍可播。

## 授權

- 本專案程式與原創指法圖：**MIT**（見 [`LICENSE`](LICENSE)）
- Alto 取樣音檔：**MIT**（Fluid R3，見 `samples/LICENSE.txt`）
- 示範曲 Practice Riff 為本專案原創練習句

**不是** PlayThatSheet 的複製，也沒有公開曲庫。

開發決定與指法表詳見 [`開發紀錄.md`](開發紀錄.md)。
