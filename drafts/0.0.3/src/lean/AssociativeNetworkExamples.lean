/-
  AssociativeNetworkExamples.lean

  Практические примеры и тесты преобразований ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkExamples.v (Rocq).
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions

-- Трёхмерная ассоциативная сеть
def complexExampleNetwork : AssociativeNetworkTupleFunction 3 :=
  fun id => match id with
  | 0 => #v[0, 0, 0]
  | 1 => #v[1, 1, 2]
  | 2 => #v[2, 4, 0]
  | 3 => #v[3, 0, 5]
  | 4 => #v[4, 1, 1]
  | _ => #v[0, 0, 0]

-- Кортежи ссылок
def exampleTuple0 : TupleOfLinks 0 := #v[]
def exampleTuple1 : TupleOfLinks 1 := #v[0]
def exampleTuple4 : TupleOfLinks 4 := #v[3, 2, 1, 0]

-- Преобразование кортежей ссылок во вложенные упорядоченные пары (списки)
def nestedPair0 := TupleOfLinksToNestedPair exampleTuple0
def nestedPair1 := TupleOfLinksToNestedPair exampleTuple1
def nestedPair4 := TupleOfLinksToNestedPair exampleTuple4

#eval nestedPair0 -- Ожидается результат: []
#eval nestedPair1 -- Ожидается результат: [0]
#eval nestedPair4 -- Ожидается результат: [3, 2, 1, 0]

-- Вычисление значений преобразованной функции трёхмерной ассоциативной сети
#eval (TupleFunctionToNestedPairFunction complexExampleNetwork) 0 -- Ожидается результат: [0, 0, 0]
#eval (TupleFunctionToNestedPairFunction complexExampleNetwork) 1 -- Ожидается результат: [1, 1, 2]
#eval (TupleFunctionToNestedPairFunction complexExampleNetwork) 2 -- Ожидается результат: [2, 4, 0]
#eval (TupleFunctionToNestedPairFunction complexExampleNetwork) 3 -- Ожидается результат: [3, 0, 5]
#eval (TupleFunctionToNestedPairFunction complexExampleNetwork) 4 -- Ожидается результат: [4, 1, 1]
#eval (TupleFunctionToNestedPairFunction complexExampleNetwork) 5 -- Ожидается результат: [0, 0, 0]

-- Ассоциативная сеть вложенных упорядоченных пар
def testPairsNetwork : AssociativeNetworkNestedPairFunction :=
  fun id => match id with
  | 0 => [5, 0, 8]
  | 1 => [7, 1, 2]
  | 2 => [2, 4, 5]
  | 3 => [3, 1, 5]
  | 4 => [4, 2, 1]
  | _ => [0, 0, 0]

-- Преобразованная ассоциативная сеть вложенных УП в трёхмерную ассоциативную сеть (размерность должна совпадать)
def testTuplesNetwork : AssociativeNetworkTupleFunction 3 :=
  NestedPairFunctionToTupleFunction testPairsNetwork

-- Вычисление значений преобразованной функции ассоциативной сети вложенных УП
#eval (testTuplesNetwork 0).toList -- Ожидается результат: [5, 0, 8]
#eval (testTuplesNetwork 1).toList -- Ожидается результат: [7, 1, 2]
#eval (testTuplesNetwork 2).toList -- Ожидается результат: [2, 4, 5]
#eval (testTuplesNetwork 3).toList -- Ожидается результат: [3, 1, 5]
#eval (testTuplesNetwork 4).toList -- Ожидается результат: [4, 2, 1]
#eval (testTuplesNetwork 5).toList -- Ожидается результат: [0, 0, 0]

-- Преобразование вложенных УП в ассоциативную сеть дуплетов
#eval NestedPairToDupletList [121, 21, 1343]
-- Должно вернуть: [(121, 1), (21, 2), (1343, 2)]

-- Добавление вложенных УП в ассоциативную сеть дуплетов
#eval AddNestedPairToDupletList [(121, 1), (21, 2), (1343, 2)] [12, 23, 34]
-- Ожидается результат: [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)]

-- Преобразование ассоциативной сети дуплетов во вложенные УП
#eval DupletListToNestedPair [(121, 1), (21, 2), (1343, 2)]
-- Ожидается результат: [121, 21, 1343]

#eval DupletListToNestedPair [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)]
-- Ожидается результат: [121, 21, 1343]

-- Чтение вложенных УП из ассоциативной сети дуплетов по индексу дуплета — начала вложенных УП
#eval DupletListReadNestedPair [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)] 0
-- Ожидается результат: [121, 21, 1343]

#eval DupletListReadNestedPair [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)] 3
-- Ожидается результат: [12, 23, 34]

-- Определяем ассоциативную сеть вложенных УП
def testNestedPairList : AssociativeNetworkNestedPairList :=
  [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Преобразованная ассоциативная сеть вложенных УП в ассоциативную сеть дуплетов
def testDupletList := NestedPairListToDupletList testNestedPairList

-- Вычисление преобразованной ассоциативной сети вложенных УП в ассоциативную сеть дуплетов
#eval testDupletList

-- Вычисление преобразования ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно в testNestedPairList
#eval DupletListToNestedPairList testDupletList

-- Вычисление смещения вложенных УП в ассоциативной сети дуплетов по их порядковому номеру
#eval DupletListOffsetNestedPair testDupletList 0 -- Ожидается результат: 0
#eval DupletListOffsetNestedPair testDupletList 1 -- Ожидается результат: 3
#eval DupletListOffsetNestedPair testDupletList 2 -- Ожидается результат: 5
#eval DupletListOffsetNestedPair testDupletList 3 -- Ожидается результат: 6
#eval DupletListOffsetNestedPair testDupletList 4 -- Ожидается результат: 9
#eval DupletListOffsetNestedPair testDupletList 5 -- Ожидается результат: 11
#eval DupletListOffsetNestedPair testDupletList 6 -- Ожидается результат: 12
#eval DupletListOffsetNestedPair testDupletList 7 -- Ожидается результат: 12

-- Определяем трёхмерную ассоциативную сеть как последовательность кортежей длины 3
def testTupleList : AssociativeNetworkTupleList 3 :=
  [#v[0, 0, 0], #v[1, 1, 2], #v[2, 4, 0], #v[3, 0, 5], #v[4, 1, 1], #v[0, 0, 0]]

-- Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП
def testTuplesToDupletList : AssociativeNetworkDupletList := TupleListToDupletList testTupleList

-- Вычисление трёхмерной ассоциативной сети преобразованной в ассоциативную сеть дуплетов
#eval testTuplesToDupletList

-- Преобразование и обратно в трёхмерную ассоциативную сеть
def resultTuplesNetwork : AssociativeNetworkTupleList 3 :=
  NestedPairListToTupleList (DupletListToNestedPairList testTuplesToDupletList)

-- Итоговая проверка эквивалентности ассоциативных сетей
#eval resultTuplesNetwork.map (·.toList)
-- Ожидается результат:
-- [[0, 0, 0], [1, 1, 2], [2, 4, 0], [3, 0, 5], [4, 1, 1], [0, 0, 0]]
