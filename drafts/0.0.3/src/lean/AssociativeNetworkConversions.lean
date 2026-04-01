/-
  AssociativeNetworkConversions.lean

  Функции преобразования между различными представлениями ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkConversions.v (Rocq).
-/
import AssociativeNetworkDefinitions

-- Функция преобразования TupleOfReferences в ReferenceList
def TupleOfReferencesToReferenceList {n : Nat} (v : TupleOfReferences n) : ReferenceList :=
  v.toList

-- Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkReferenceListFunction
def TupleFunctionToReferenceListFunction {n : Nat} (a : AssociativeNetworkTupleFunction n) : AssociativeNetworkReferenceListFunction :=
  fun id => TupleOfReferencesToReferenceList (a id)

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkReferenceListList
def TupleListToReferenceListList {n : Nat} (net : AssociativeNetworkTupleList n) : AssociativeNetworkReferenceListList :=
  net.map TupleOfReferencesToReferenceList

-- Функция преобразования ReferenceList в TupleOfReferences, возвращающая option
def ReferenceListToTupleOfReferencesOption (n : Nat) (p : ReferenceList) : Option (TupleOfReferences n) :=
  let arr := p.toArray
  if h : arr.size = n then
    some ⟨arr, h⟩
  else
    none

-- Функция преобразования ReferenceList в TupleOfReferences с использованием TupleOfReferencesDefault
def ReferenceListToTupleOfReferences (n : Nat) (p : ReferenceList) : TupleOfReferences n :=
  match ReferenceListToTupleOfReferencesOption n p with
  | none => TupleOfReferencesDefault n
  | some t => t

-- Функция преобразования AssociativeNetworkReferenceListFunction в AssociativeNetworkTupleFunction
def ReferenceListFunctionToTupleFunction {n : Nat} (net : AssociativeNetworkReferenceListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match ReferenceListToTupleOfReferencesOption n (net id) with
  | some t => t
  | none => TupleOfReferencesDefault n

-- Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkTupleList
def ReferenceListListToTupleList {n : Nat} (net : AssociativeNetworkReferenceListList) : AssociativeNetworkTupleList n :=
  net.map (ReferenceListToTupleOfReferences n)

-- Функция преобразования ReferenceList в AssociativeNetworkDupletList со смещением индексации
def ReferenceListToDupletList_ (offset : Nat) : ReferenceList → AssociativeNetworkDupletList
  | [] => []
  | [h] => [(h, offset)]
  | h :: t => (h, offset + 1) :: ReferenceListToDupletList_ (offset + 1) t

-- Функция преобразования ReferenceList в AssociativeNetworkDupletList
def ReferenceListToDupletList (np : ReferenceList) : AssociativeNetworkDupletList :=
  ReferenceListToDupletList_ 0 np

-- Функция добавления ReferenceList в хвост AssociativeNetworkDupletList
def AddReferenceListToDupletList (anet : AssociativeNetworkDupletList) (np : ReferenceList) : AssociativeNetworkDupletList :=
  anet ++ ReferenceListToDupletList_ anet.length np

-- Функция отрезает голову anetd и возвращает хвост начиная с offset
def DupletListBehead (anet : AssociativeNetworkDupletList) : Nat → AssociativeNetworkDupletList
  | 0 => anet
  | Nat.succ n => match anet with
    | [] => []
    | _ :: t => DupletListBehead t n

-- Функция преобразования AssociativeNetworkDupletList в ReferenceList с индексацией в начале AssociativeNetworkDupletList начиная с offset
def DupletListToReferenceList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : ReferenceList :=
  match anet with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == index then
      x :: DupletListToReferenceList_ tail_anet (offset + 1) next_index
    else
      DupletListToReferenceList_ tail_anet (offset + 1) index

-- Функция чтения ReferenceList из AssociativeNetworkDupletList по индексу дуплета
def DupletListReadReferenceList (anet : AssociativeNetworkDupletList) (index : Nat) : ReferenceList :=
  DupletListToReferenceList_ anet 0 index

-- Функция преобразования AssociativeNetworkDupletList в ReferenceList начиная с головы списка ассоциативной сети
def DupletListToReferenceList (anet : AssociativeNetworkDupletList) : ReferenceList :=
  DupletListReadReferenceList anet 0

/-
  Теперь всё готово для преобразования ассоциативной сети вложенных упорядоченных пар anetl : Reference → ReferenceList
  в ассоциативную сеть дуплетов anetd : Reference → Reference².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  ассоциативной сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
-/

-- Функция добавления AssociativeNetworkReferenceListList в AssociativeNetworkDupletList
def AddReferenceListListToDupletList : AssociativeNetworkDupletList → AssociativeNetworkReferenceListList → AssociativeNetworkDupletList
  | anetd, [] => anetd
  | anetd, h :: t => AddReferenceListListToDupletList (AddReferenceListToDupletList anetd h) t

-- Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkDupletList
def ReferenceListListToDupletList : AssociativeNetworkReferenceListList → AssociativeNetworkDupletList
  | [] => []
  | h :: t => AddReferenceListListToDupletList (ReferenceListToDupletList h) t

-- Функция поиска ReferenceList в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
-- Возвращает offset ReferenceList.
def DupletListOffsetReferenceList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : Nat :=
  match anet with
  | [] => offset + anet.length
  | (_, next_index) :: tail_anet =>
    match index with
    | 0 => offset
    | Nat.succ index' =>
      if offset == next_index then
        DupletListOffsetReferenceList_ tail_anet (offset + 1) index'
      else
        DupletListOffsetReferenceList_ tail_anet (offset + 1) index

-- Функция поиска ReferenceList в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset ReferenceList.
def DupletListOffsetReferenceList (anet : AssociativeNetworkDupletList) (index : Nat) : Nat :=
  DupletListOffsetReferenceList_ anet 0 index

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList
def TupleListToDupletList {n : Nat} (anetv : AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  ReferenceListListToDupletList (TupleListToReferenceListList anetv)

/-
  Теперь всё готово для преобразования ассоциативной сети дуплетов anetd : Reference → Reference²
  в ассоциативную сеть вложенных упорядоченных пар anetl : Reference → ReferenceList.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetReferenceList для
  ассоциативной сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
-/

-- Функция отрезает первую ReferenceList из AssociativeNetworkDupletList и возвращает хвост
def DupletListBeheadReferenceList (anet : AssociativeNetworkDupletList) (offset : Nat) : AssociativeNetworkDupletList :=
  match anet with
  | [] => []
  | (_, next_index) :: tail_anet =>
    if offset == next_index then
      tail_anet
    else
      DupletListBeheadReferenceList tail_anet (offset + 1)

-- Функция преобразования ReferenceList и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkReferenceListList
def DupletListToReferenceListList_ (anetd : AssociativeNetworkDupletList) (np : ReferenceList) (offset : Nat) : AssociativeNetworkReferenceListList :=
  match anetd with
  | [] => []  -- отбрасываем ReferenceList даже если она недостроена
  | (x, next_index) :: tail_anet =>
    if offset == next_index then  -- конец ReferenceList, переходим к следующей ReferenceList
      (np ++ [x]) :: DupletListToReferenceListList_ tail_anet [] (offset + 1)
    else  -- ещё не конец ReferenceList, парсим ассоциативную сеть дуплетов дальше
      DupletListToReferenceListList_ tail_anet (np ++ [x]) (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkReferenceListList
def DupletListToReferenceListList (anetd : AssociativeNetworkDupletList) : AssociativeNetworkReferenceListList :=
  DupletListToReferenceListList_ anetd [] ReferenceDefault
