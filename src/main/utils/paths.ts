import path from 'path'

export const paths = {
  getPreloadPath() {
    return path.join(__dirname, '../preload/index.js')
  },
  getViewPreloadPath() {
    return path.join(__dirname, '../preload/view.js')
  },
  getRendererPath() {
    return path.join(__dirname, '../renderer/index.html')
  },
  getAssetPath(...segments: string[]) {
    return path.join(__dirname, 'assets', ...segments)
  },
}
