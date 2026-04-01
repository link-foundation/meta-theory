/-
  AssociativeNetworkConversions.lean

  Функции преобразования между различными представлениями ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkConversions.v (Rocq).
-/
import AssociativeNetworkDefinitions

-- Функция преобразования TupleOfLinks в NestedPair
def TupleOfLinksToNestedPair {n : Nat} (v : TupleOfLinks n) : NestedPair :=
  v.toList

-- Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkNestedPairFunction
def TupleFunctionToNestedPairFunction {n : Nat} (a : AssociativeNetworkTupleFunction n) : AssociativeNetworkNestedPairFunction :=
  fun id => TupleOfLinksToNestedPair (a id)

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkNestedPairList
def TupleListToNestedPairList {n : Nat} (net : AssociativeNetworkTupleList n) : AssociativeNetworkNestedPairList :=
  net.map TupleOfLinksToNestedPair

-- Функция преобразования NestedPair в TupleOfLinks, возвращающая option
def NestedPairToTupleOfLinksOption (n : Nat) (p : NestedPair) : Option (TupleOfLinks n) :=
  if h : p.length = n then
    some (⟨p, h⟩)
  else
    none

-- Функция преобразования NestedPair в TupleOfLinks с использованием TupleOfLinksDefault
def NestedPairToTupleOfLinks (n : Nat) (p : NestedPair) : TupleOfLinks n :=
  match NestedPairToTupleOfLinksOption n p with
  | none => TupleOfLinksDefault n
  | some t => t

-- Функция преобразования AssociativeNetworkNestedPairFunction в AssociativeNetworkTupleFunction
def NestedPairFunctionToTupleFunction {n : Nat} (net : AssociativeNetworkNestedPairFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match NestedPairToTupleOfLinksOption n (net id) with
  | some t => t
  | none => TupleOfLinksDefault n

-- Функция преобразования AssociativeNetworkNestedPairList в AssociativeNetworkTupleList
def NestedPairListToTupleList {n : Nat} (net : AssociativeNetworkNestedPairList) : AssociativeNetworkTupleList n :=
  net.map (NestedPairToTupleOfLinks n)

-- Функция преобразования NestedPair в AssociativeNetworkDupletList со смещением индексации
def NestedPairToDupletList_ (offset : Nat) : NestedPair → AssociativeNetworkDupletList
  | [] => []
  | [h] => [(h, offset)]
  | h :: t => (h, offset + 1) :: NestedPairToDupletList_ (offset + 1) t

-- Функция преобразования NestedPair в AssociativeNetworkDupletList
def NestedPairToDupletList (np : NestedPair) : AssociativeNetworkDupletList :=
  NestedPairToDupletList_ 0 np

-- Функция добавления NestedPair в хвост AssociativeNetworkDupletList
def AddNestedPairToDupletList (anet : AssociativeNetworkDupletList) (np : NestedPair) : AssociativeNetworkDupletList :=
  anet ++ NestedPairToDupletList_ anet.length np

-- Функция отрезает голову anetd и возвращает хвост начиная с offset
def DupletListBehead (anet : AssociativeNetworkDupletList) : Nat → AssociativeNetworkDupletList
  | 0 => anet
  | Nat.succ n => match anet with
    | [] => []
    | _ :: t => DupletListBehead t n

-- Функция преобразования AssociativeNetworkDupletList в NestedPair с индексацией в начале AssociativeNetworkDupletList начиная с offset
def DupletListToNestedPair_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : NestedPair :=
  match anet with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == index then
      x :: DupletListToNestedPair_ tail_anet (offset + 1) next_index
    else
      DupletListToNestedPair_ tail_anet (offset + 1) index

-- Функция чтения NestedPair из AssociativeNetworkDupletList по индексу дуплета
def DupletListReadNestedPair (anet : AssociativeNetworkDupletList) (index : Nat) : NestedPair :=
  DupletListToNestedPair_ anet 0 index

-- Функция преобразования AssociativeNetworkDupletList в NestedPair начиная с головы списка ассоциативной сети
def DupletListToNestedPair (anet : AssociativeNetworkDupletList) : NestedPair :=
  DupletListReadNestedPair anet 0

-- Функция добавления AssociativeNetworkNestedPairList в AssociativeNetworkDupletList
def AddNestedPairListToDupletList : AssociativeNetworkDupletList → AssociativeNetworkNestedPairList → AssociativeNetworkDupletList
  | anetd, [] => anetd
  | anetd, h :: t => AddNestedPairListToDupletList (AddNestedPairToDupletList anetd h) t

-- Функция преобразования AssociativeNetworkNestedPairList в AssociativeNetworkDupletList
def NestedPairListToDupletList : AssociativeNetworkNestedPairList → AssociativeNetworkDupletList
  | [] => []
  | h :: t => AddNestedPairListToDupletList (NestedPairToDupletList h) t

-- Функция поиска NestedPair в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
-- Возвращает offset NestedPair.
def DupletListOffsetNestedPair_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : Nat :=
  match anet with
  | [] => offset + anet.length
  | (_, next_index) :: tail_anet =>
    match index with
    | 0 => offset
    | Nat.succ index' =>
      if offset == next_index then
        DupletListOffsetNestedPair_ tail_anet (offset + 1) index'
      else
        DupletListOffsetNestedPair_ tail_anet (offset + 1) index

-- Функция поиска NestedPair в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset NestedPair.
def DupletListOffsetNestedPair (anet : AssociativeNetworkDupletList) (index : Nat) : Nat :=
  DupletListOffsetNestedPair_ anet 0 index

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList
def TupleListToDupletList {n : Nat} (anetv : AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  NestedPairListToDupletList (TupleListToNestedPairList anetv)

-- Функция отрезает первую NestedPair из AssociativeNetworkDupletList и возвращает хвост
def DupletListBeheadNestedPair (anet : AssociativeNetworkDupletList) (offset : Nat) : AssociativeNetworkDupletList :=
  match anet with
  | [] => []
  | (_, next_index) :: tail_anet =>
    if offset == next_index then
      tail_anet
    else
      DupletListBeheadNestedPair tail_anet (offset + 1)

-- Функция преобразования NestedPair и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkNestedPairList
def DupletListToNestedPairList_ (anetd : AssociativeNetworkDupletList) (np : NestedPair) (offset : Nat) : AssociativeNetworkNestedPairList :=
  match anetd with
  | [] => []  -- отбрасываем NestedPair даже если она недостроена
  | (x, next_index) :: tail_anet =>
    if offset == next_index then  -- конец NestedPair, переходим к следующей NestedPair
      (np ++ [x]) :: DupletListToNestedPairList_ tail_anet [] (offset + 1)
    else  -- ещё не конец NestedPair, парсим ассоциативную сеть дуплетов дальше
      DupletListToNestedPairList_ tail_anet (np ++ [x]) (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkNestedPairList
def DupletListToNestedPairList (anetd : AssociativeNetworkDupletList) : AssociativeNetworkNestedPairList :=
  DupletListToNestedPairList_ anetd [] LinkDefault
