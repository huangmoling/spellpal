/**
 * 给打包出来的 exe 写图标和版本信息。
 *
 * 为什么需要这一步：package.json 里 `signAndEditExecutable: false`（本机打包时
 * electron-builder 解压签名工具会失败），代价是产出的 exe 还带着 Electron 的
 * 默认图标和「GitHub, Inc.」版本信息。这里用纯 JS 的 resedit 补上，
 * 再用 `--prepackaged` 重封安装包。
 *
 *   node scripts/patch-exe.cjs [exe] [ico]
 *   npx electron-builder --prepackaged release/win-unpacked --win nsis portable
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))

const exePath = process.argv[2] || path.join(root, 'release', 'win-unpacked', 'SpellPal.exe')
const icoPath = process.argv[3] || path.join(root, 'build', 'icon.ico')

if (!fs.existsSync(exePath)) {
  console.error('找不到 exe：' + exePath)
  process.exit(1)
}
if (!fs.existsSync(icoPath)) {
  console.error('找不到 ico：' + icoPath)
  process.exit(1)
}

require('resedit/cjs')
  .load()
  .then((ResEdit) => {
    const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath))
    const res = ResEdit.NtExecutableResource.from(exe)

    const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
    if (vi) {
      const [a, b, c] = pkg.version.split('.').map((n) => parseInt(n, 10) || 0)
      vi.setFileVersion(a, b, c, 0)
      vi.setProductVersion(a, b, c, 0)
      vi.setStringValues(
        { lang: 1033, codepage: 1200 },
        {
          ProductName: 'SpellPal',
          FileDescription: '小拼手 SpellPal',
          CompanyName: 'SpellPal',
          LegalCopyright: 'MIT License',
          OriginalFilename: path.basename(exePath),
          InternalName: 'SpellPal',
        },
      )
      vi.outputToResourceEntries(res.entries)
    }

    const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      1033,
      ico.icons.map((i) => i.data),
    )

    res.outputResource(exe)
    fs.writeFileSync(exePath, Buffer.from(exe.generate()))
    console.log(`已写入图标与版本：${path.basename(exePath)} v${pkg.version}（${ico.icons.length} 种尺寸）`)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
