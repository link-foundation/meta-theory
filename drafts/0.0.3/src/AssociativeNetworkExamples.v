Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.

(* Нотация записи списков *)
Notation "{ }" := (nil) (at level 0).
Notation "{ x , .. , y }" := (cons x .. (cons y nil) ..) (at level 0).

(* Трёхмерная ассоциативная сеть *)
Definition complexExampleNetwork : AssociativeNetworkVectorFunction 3 :=
  fun id => match id with
  | 0 => [0; 0; 0]
  | 1 => [1; 1; 2]
  | 2 => [2; 4; 0]
  | 3 => [3; 0; 5]
  | 4 => [4; 1; 1]
  | S _ => [0; 0; 0]
  end.

(* Вектора ссылок *)
Definition exampleTuple0 : VectorOfLinks 0 := [].
Definition exampleTuple1 : VectorOfLinks 1 := [0].
Definition exampleTuple4 : VectorOfLinks 4 := [3; 2; 1; 0].

(* Преобразование векторов ссылок во вложенные упорядоченные пары (списки) *)
Definition nestedPair0 := VectorOfLinksToNestedPair exampleTuple0.
Definition nestedPair1 := VectorOfLinksToNestedPair exampleTuple1.
Definition nestedPair4 := VectorOfLinksToNestedPair exampleTuple4.

Compute nestedPair0. (* Ожидается результат: { } *)
Compute nestedPair1. (* Ожидается результат: {0} *)
Compute nestedPair4. (* Ожидается результат: {3, 2, 1, 0} *)

(* Вычисление значений преобразованной функции трёхмерной ассоциативной сети *)
Compute (VectorFunctionToNestedPairFunction complexExampleNetwork) 0. (* Ожидается результат: {0, 0, 0} *)
Compute (VectorFunctionToNestedPairFunction complexExampleNetwork) 1. (* Ожидается результат: {1, 1, 2} *)
Compute (VectorFunctionToNestedPairFunction complexExampleNetwork) 2. (* Ожидается результат: {2, 4, 0} *)
Compute (VectorFunctionToNestedPairFunction complexExampleNetwork) 3. (* Ожидается результат: {3, 0, 5} *)
Compute (VectorFunctionToNestedPairFunction complexExampleNetwork) 4. (* Ожидается результат: {4, 1, 1} *)
Compute (VectorFunctionToNestedPairFunction complexExampleNetwork) 5. (* Ожидается результат: {0, 0, 0} *)

(* Ассоциативная сеть вложенных упорядоченных пар *)
Definition testPairsNetwork : AssociativeNetworkNestedPairFunction :=
  fun id => match id with
  | 0 => {5, 0, 8}
  | 1 => {7, 1, 2}
  | 2 => {2, 4, 5}
  | 3 => {3, 1, 5}
  | 4 => {4, 2, 1}
  | S _ => {0, 0, 0}
  end.

(* Преобразованная ассоциативная сеть вложенных УП в трёхмерную ассоциативную сеть (размерность должна совпадать) *)
Definition testTuplesNetwork : AssociativeNetworkVectorFunction 3 :=
  NestedPairFunctionToVectorFunction testPairsNetwork.

(* Вычисление значений преобразованной функции ассоциативной сети вложенных УП *)
Compute testTuplesNetwork 0. (* Ожидается результат: [5; 0; 8] *)
Compute testTuplesNetwork 1. (* Ожидается результат: [7; 1; 2] *)
Compute testTuplesNetwork 2. (* Ожидается результат: [2; 4; 5] *)
Compute testTuplesNetwork 3. (* Ожидается результат: [3; 1; 5] *)
Compute testTuplesNetwork 4. (* Ожидается результат: [4; 2; 1] *)
Compute testTuplesNetwork 5. (* Ожидается результат: [0; 0; 0] *)

(* Преобразование вложенных УП в ассоциативную сеть дуплетов *)
Compute NestedPairToDupletList { 121, 21, 1343 }.
(* Должно вернуть: {(121, 1), (21, 2), (1343, 2)} *)

(* Добавление вложенных УП в ассоциативную сеть дуплетов *)
Compute AddNestedPairToDupletList {(121, 1), (21, 2), (1343, 2)} {12, 23, 34}.
(* Ожидается результат: {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} *)

(* Преобразование ассоциативной сети дуплетов во вложенные УП *)
Compute DupletListToNestedPair {(121, 1), (21, 2), (1343, 2)}.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListToNestedPair {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)}.
(* Ожидается результат: {121, 21, 1343} *)

(* Чтение вложенных УП из ассоциативной сети дуплетов по индексу дуплета — начала вложенных УП *)
Compute DupletListReadNestedPair {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 0.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListReadNestedPair {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 3.
(* Ожидается результат: {12, 23, 34} *)

(* Определяем ассоциативную сеть вложенных УП *)
Definition testNestedPairList := { {121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34} }.

(* Преобразованная ассоциативная сеть вложенных УП в ассоциативную сеть дуплетов *)
Definition testDupletList := NestedPairListToDupletList testNestedPairList.

(* Вычисление преобразованной ассоциативной сети вложенных УП в ассоциативную сеть дуплетов *)
Compute testDupletList.
(* Ожидается результат:
 {(121, 1), (21, 2), (1343, 2),
  (12, 4), (23, 4),
  (34, 5),
  (121, 7), (21, 8), (1343, 8),
  (12, 10), (23, 10),
  (34, 11)} *)

(* Вычисление преобразования ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно в testNestedPairList *)
Compute DupletListToNestedPairList testDupletList.
(* Ожидается результат:
  {{121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34}} *)

(* Вычисление смещения вложенных УП в ассоциативной сети дуплетов по их порядковому номеру *)
Compute DupletListOffsetNestedPair testDupletList 0. (* Ожидается результат: 0 *)
Compute DupletListOffsetNestedPair testDupletList 1. (* Ожидается результат: 3 *)
Compute DupletListOffsetNestedPair testDupletList 2. (* Ожидается результат: 5 *)
Compute DupletListOffsetNestedPair testDupletList 3. (* Ожидается результат: 6 *)
Compute DupletListOffsetNestedPair testDupletList 4. (* Ожидается результат: 9 *)
Compute DupletListOffsetNestedPair testDupletList 5. (* Ожидается результат: 11 *)
Compute DupletListOffsetNestedPair testDupletList 6. (* Ожидается результат: 12 *)
Compute DupletListOffsetNestedPair testDupletList 7. (* Ожидается результат: 12 *)

(* Определяем трёхмерную ассоциативную сеть как последовательность векторов длины 3 *)
Definition testVectorList : AssociativeNetworkVectorList 3 :=
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] }.

(* Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП *)
Definition testVectorsToDupletList : AssociativeNetworkDupletList := VectorListToDupletList testVectorList.

(* Вычисление трёхмерной ассоциативной сети преобразованной в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП *)
Compute testVectorsToDupletList.
(* Ожидается результат:
{ (0, 1), (0, 2), (0, 2),
  (1, 4), (1, 5), (2, 5),
  (2, 7), (4, 8), (0, 8),
  (3, 10), (0, 11), (5, 11),
  (4, 13), (1, 14), (1, 14),
  (0, 16), (0, 17), (0, 17)} *)

(* Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП и обратно в трёхмерную ассоциативную сеть *)
Definition resultTuplesNetwork : AssociativeNetworkVectorList 3 :=
  NestedPairListToVectorList (DupletListToNestedPairList testVectorsToDupletList).

(* Итоговая проверка эквивалентности ассоциативных сетей *)
Compute resultTuplesNetwork.
(* Ожидается результат:
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] } *)
