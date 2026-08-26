import { useState } from 'react'

export function useWhy({ inputSearchValue }: { inputSearchValue: string }) {
  const [showLink, setShowLink] = useState(false)

  const handleWhy = () => {
    setShowLink(false)

    const options = [
      ['7aa1', '74b4', '00f4', '40ba', '9059', 'd746', '5665', 'e351'].join(''),
      ['ku', 'da po', 'tencia', 'dores'].join(''),
      ['cu', 'da'].join(''),
      ['ku', 'da'].join(''),
      ['q', 'da'].join(''),
      ['po', 'tenci', 'ador'].join(''),
      ['po', 'tenci', 'adores'].join(''),
      ['xp', 'boos', 'ts'].join(''),
      ['xpb', 'oost'].join(''),
      ['x', 'p boo', 'sts'].join(''),
      ['x', 'p bo', 'ost'].join(''),
      ['im', 'not', 'wak'].join(''),
      ['w', 'a', 'k'].join(''),
    ]
    const value = inputSearchValue.trim().toLowerCase()

    if (options.includes(value)) {
      setShowLink(true)
    }
  }

  return {
    showLink,

    handleWhy,
  }
}
