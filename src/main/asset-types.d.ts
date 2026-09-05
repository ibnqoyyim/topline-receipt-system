declare module '*.png?asset' {
  const assetPath: string
  export default assetPath
}

declare module '*.ico?asset' {
  const assetPath: string
  export default assetPath
}

declare module '*.png' {
  const src: string
  export default src
}
