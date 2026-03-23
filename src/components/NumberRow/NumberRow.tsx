import { NumberToken } from '../../core/models/Token'
import styles from './NumberRow.module.css'

interface NumberRowProps {
  numbers: number[]        // e.g. [3, 7, 2, 5] – Z1=idx0, Z2=idx1, Z3=idx2, Z4=idx3
  usedIndices: number[]
  onPress: (token: NumberToken) => void
}

export function NumberRow({ numbers, usedIndices, onPress }: NumberRowProps) {
  // Layout: [Z4] [Z3] [Z1] [Z2]
  // indices in display order: 3, 2, 0, 1
  const displayOrder = [3, 2, 0, 1]

  return (
    <div className={styles.row}>
      {displayOrder.map((idx) => {
        const exists = idx < numbers.length
        const used = usedIndices.includes(idx)
        if (!exists) return <div key={idx} className={styles.empty} />
        return (
          <button
            key={idx}
            className={`${styles.btn} ${used ? styles.used : ''}`}
            onClick={() => !used && onPress({ type: 'number', value: numbers[idx], index: idx })}
            disabled={used}
          >
            {used ? '' : numbers[idx]}
          </button>
        )
      })}
    </div>
  )
}
